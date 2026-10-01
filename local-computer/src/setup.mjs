import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { stateDir } from "./config.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
mkdirSync(stateDir, { recursive: true, mode: 0o700 });
const path = join(stateDir, "config.json");
if (existsSync(path))
  throw new Error(
    `Configuration already exists at ${path}; edit it explicitly to preserve your settings.`,
  );
const config = {
  fleetRoot: resolve(option("--fleet", join(homedir(), "Develop/fleet"))),
  endpoint: option("--endpoint", "http://127.0.0.1:8000/v1"),
  model: option("--model", ""),
  port: Number(option("--port", "4310")),
  hostOverrides: {},
};
writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
writeFileSync(join(stateDir, "token"), randomBytes(32).toString("hex"), {
  mode: 0o600,
});
console.log(
  `Created private configuration: ${path}. Add verified hostOverrides before observation.`,
);
