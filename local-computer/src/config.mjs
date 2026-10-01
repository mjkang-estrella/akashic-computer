import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const stateDir =
  process.env.AKASHIC_STATE_DIR ||
  join(homedir(), ".local/share/akashic-local");
export function loadConfig(dir = stateDir) {
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
  if (!config.endpoint || !config.fleetRoot)
    throw new Error("Run npm run setup first.");
  const url = new URL(config.endpoint);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Invalid configured model endpoint.");
  return config;
}
export function inventory(config) {
  const source = JSON.parse(
    readFileSync(join(config.fleetRoot, "inventory/hosts.json"), "utf8"),
  );
  return source.hosts.map((host) => ({
    ...host,
    ...(config.hostOverrides?.[host.id] || {}),
    baselineDate: source.baseline_date,
  }));
}
