import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { stateDir, loadConfig } from "./config.mjs";
import { systemdUnit } from "./systemd-unit.mjs";
loadConfig();
const root = fileURLToPath(new URL("../", import.meta.url));
if (process.platform === "linux") {
  const dir = join(homedir(), ".config/systemd/user");
  mkdirSync(dir, { recursive: true });
  const entry = existsSync(join(root, "dist/controller.cjs"))
    ? join(root, "dist/controller.cjs")
    : join(root, "src/server.mjs");
  writeFileSync(
    join(dir, "akashic-computer.service"),
    systemdUnit({ node: process.execPath, entry, root, stateDir }),
    { mode: 0o600 },
  );
  if (process.argv.includes("--write-only")) {
    console.log("Prepared Linux user service without starting it.");
    process.exit(0);
  }
  const linger = execFileSync(
    "loginctl",
    ["show-user", userInfo().username, "-p", "Linger", "--value"],
    { encoding: "utf8" },
  ).trim();
  if (linger !== "yes")
    throw new Error(
      "Enable user lingering before installing an always-on controller: sudo loginctl enable-linger " +
        userInfo().username,
    );
  execFileSync("systemctl", ["--user", "daemon-reload"]);
  execFileSync("systemd-analyze", [
    "--user",
    "verify",
    join(dir, "akashic-computer.service"),
  ]);
  execFileSync("systemctl", [
    "--user",
    "enable",
    "--now",
    "akashic-computer.service",
  ]);
  console.log(
    "Akashic Computer controller enabled as a persistent Linux user service.",
  );
  process.exit(0);
}
if (process.platform !== "darwin")
  throw new Error(
    "Service installation supports macOS and Linux.",
  );
const label = "computer.akashic.local";
const destination = join(homedir(), "Library/LaunchAgents", label + ".plist");
const xml = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
mkdirSync(join(stateDir, "logs"), { recursive: true, mode: 0o700 });
mkdirSync(join(homedir(), "Library/LaunchAgents"), { recursive: true });
writeFileSync(
  destination,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(root, "src/server.mjs"))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>AKASHIC_STATE_DIR</key><string>${xml(stateDir)}</string><key>PATH</key><string>/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${xml(join(stateDir, "logs/controller.log"))}</string>
<key>StandardErrorPath</key><string>${xml(join(stateDir, "logs/controller-error.log"))}</string>
</dict></plist>`,
  { mode: 0o600 },
);
const domain = `gui/${process.getuid()}`;
try {
  execFileSync("launchctl", ["print", domain + "/" + label], {
    stdio: "ignore",
  });
  console.log(
    "Service already registered; use launchctl kickstart only after active jobs finish.",
  );
} catch {
  execFileSync("launchctl", ["bootstrap", domain, destination]);
  console.log(
    "Installed Akashic Computer user service. It runs at login and keeps jobs independent of browser tabs.",
  );
}
