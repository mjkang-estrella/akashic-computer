import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { stateDir } from "./config.mjs";
import { cloudCall } from "./cloud.mjs";
const option = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1];
};
const site = option("--site")?.replace(/\/$/, "");
const code = option("--code");
if (!site || !code)
  throw new Error(
    "Usage: npm run connect -- --site https://YOUR.convex.site --code CODE",
  );
const url = new URL(site);
if (
  url.protocol !== "https:" &&
  !(
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname)
  )
)
  throw new Error("Use a trusted HTTPS Convex endpoint.");
if (existsSync(join(stateDir, "cloud.json")))
  throw new Error(
    "Controller is already paired. Revoke the old connector and archive cloud.json before pairing another account.",
  );
const token = randomBytes(32).toString("hex");
const configuration = { site, token };
const result = await cloudCall(
  "enroll",
  {
    code,
    name: option("--name") || hostname(),
    credentialHash: createHash("sha256").update(token).digest("hex"),
  },
  configuration,
);
console.log(
  "Now confirm this computer in the signed-in Computers page. Waiting up to 10 minutes.",
);
for (let i = 0; i < 300; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const status = await cloudCall(
    "enrollment-status",
    { id: result.enrollmentId },
    configuration,
  );
  if (status.status === "approved") {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(stateDir, "cloud.json"),
      JSON.stringify(
        { ...configuration, connectorId: status.connectorId },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      "Connected. The running controller will register the fleet automatically.",
    );
    process.exit(0);
  }
}
throw new Error("Enrollment expired. Generate a new code.");
