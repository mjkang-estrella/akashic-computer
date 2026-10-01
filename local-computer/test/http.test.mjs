import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import http from "node:http";
test("HTTP boundary requires authentication, validates origin and host, and keeps token out of HTML", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "akashic-http-"));
  mkdirSync(join(dir, "inventory"));
  writeFileSync(join(dir, "inventory/hosts.json"), '{"hosts":[]}');
  const socket = net.createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({ endpoint: "http://127.0.0.1:1/v1", fleetRoot: dir, port }),
  );
  writeFileSync(join(dir, "token"), "test-only-token-not-a-secret");
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, AKASHIC_STATE_DIR: dir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await once(child, "exit");
    rmSync(dir, { recursive: true, force: true });
  });
  await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => {
      throw new Error("Server exited");
    }),
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Startup timed out")),
        5000,
      );
      timer.unref();
    }),
  ]);
  const url = `http://127.0.0.1:${port}`;
  const post = (headers = {}, body = "{}") =>
    fetch(url + "/api/list_sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  assert.equal((await post()).status, 401);
  assert.equal(
    (
      await post({
        Authorization: "Bearer test-only-token-not-a-secret",
        Origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(
      url + "/api/list_sessions",
      {
        method: "POST",
        headers: {
          Host: "attacker.example",
          Authorization: "Bearer test-only-token-not-a-secret",
          "Content-Type": "application/json",
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end("{}");
  });
  assert.equal(invalidHostStatus, 403);
  assert.equal(
    (await post({ Authorization: "Bearer test-only-token-not-a-secret" }))
      .status,
    200,
  );
  const login = await fetch(url + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "test-only-token-not-a-secret" }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.equal(
    (await post({ Cookie: login.headers.get("set-cookie").split(";")[0] }))
      .status,
    200,
  );
  const html = await (await fetch(url)).text();
  assert.ok(!html.includes("test-only-token-not-a-secret"));
});
