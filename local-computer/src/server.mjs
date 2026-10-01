import http from "node:http";
import {
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { stateDir, loadConfig } from "./config.mjs";
import { Store } from "./store.mjs";
import { Fleet } from "./fleet.mjs";
import { Runner } from "./runner.mjs";
import { Service } from "./service.mjs";
import { CloudRelay } from "./cloud.mjs";

const config = loadConfig();
const lock = join(stateDir, "controller.lock");
try {
  if (process.platform !== "win32") {
    try {
      const pid = Number(readFileSync(lock, "utf8"));
      process.kill(pid, 0);
      throw new Error("Controller is already running");
    } catch (e) {
      if (e.message === "Controller is already running" || e.code === "EPERM")
        throw e;
      if (e.code !== "ENOENT") unlinkSync(lock);
    }
  }
  const fd = openSync(lock, "wx", 0o600);
  writeFileSync(fd, String(process.pid));
  closeSync(fd);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const tokenPath = join(stateDir, "token");
let token;
try {
  token = readFileSync(tokenPath, "utf8").trim();
} catch {
  token = randomBytes(32).toString("hex");
  writeFileSync(tokenPath, token, { mode: 0o600 });
}
const store = new Store(stateDir);
const fleet = new Fleet(config);
const runner = new Runner(store, fleet, config);
const service = new Service(store, fleet, runner, config);
const relay = new CloudRelay(store, fleet, runner, config);
relay.start();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const equal = (candidate) => {
  const a = Buffer.from(candidate || "");
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};
const send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  const expectedHost = `127.0.0.1:${config.port}`;
  if (
    req.headers.host !== expectedHost &&
    req.headers.host !== `localhost:${config.port}`
  )
    return send(res, 403, { error: "Invalid host" });
  if (
    req.headers.origin &&
    ![`http://${expectedHost}`, `http://localhost:${config.port}`].includes(
      req.headers.origin,
    )
  )
    return send(res, 403, { error: "Invalid origin" });
  const url = new URL(req.url, `http://${expectedHost}`);
  if (req.method === "GET" && url.pathname === "/healthz")
    return send(res, 200, { status: "ok", version: "0.4.0" });
  if (req.method === "POST" && url.pathname === "/api/login") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1000)
        return send(res, 413, { error: "Request too large" });
    }
    try {
      if (!equal(JSON.parse(body).token))
        return send(res, 401, { error: "Incorrect local access token" });
    } catch {
      return send(res, 400, { error: "Invalid request" });
    }
    res.setHeader(
      "Set-Cookie",
      `akashic_session=${token}; HttpOnly; SameSite=Strict; Path=/`,
    );
    return send(res, 200, { ok: true });
  }
  if (url.pathname.startsWith("/api/")) {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("akashic_session="))
      ?.slice(16);
    if (
      !equal(req.headers.authorization?.replace(/^Bearer /, "")) &&
      !equal(cookie)
    )
      return send(res, 401, { error: "Local sign-in required" });
    if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return send(res, 415, { error: "JSON required" });
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 70000)
        return send(res, 413, { error: "Request too large" });
    }
    try {
      const result = await service.call(
        url.pathname.slice(5),
        JSON.parse(body),
      );
      return send(res, 200, result);
    } catch (e) {
      return send(res, 400, {
        error:
          e.name === "ZodError" ? "Invalid operation arguments" : e.message,
      });
    }
  }
  const files = {
    "/": ["dist/index.html", "text/html"],
    "/app.js": ["dist/app.js", "text/javascript"],
    "/style.css": ["dist/style.css", "text/css"],
  };
  if (req.method !== "GET" || !files[url.pathname])
    return send(res, 404, { error: "Not found" });
  const [path, type] = files[url.pathname];
  try {
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    });
    res.end(readFileSync(join(root, path)));
  } catch {
    send(res, 503, { error: "Build the UI with npm run build" });
  }
});
server.requestTimeout = 35000;
server.listen(config.port, "127.0.0.1", () =>
  console.log(`Akashic Computer is running at http://127.0.0.1:${config.port}`),
);
function stop() {
  relay.stop();
  runner.closing = true;
  runner.active?.abort.abort();
  server.close(() => {
    try {
      unlinkSync(lock);
    } catch {}
    process.exit(0);
  });
  setTimeout(() => {
    try {
      unlinkSync(lock);
    } catch {}
    process.exit(0);
  }, 2000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", () => {
  try {
    if (readFileSync(lock, "utf8") === String(process.pid)) unlinkSync(lock);
  } catch {}
});
