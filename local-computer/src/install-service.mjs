import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { stateDir, loadConfig } from "./config.mjs";
if (process.platform !== "darwin")
  throw new Error(
    "This installer targets the Mac control computer. On Linux, supervise npm start with your user service manager.",
  );
loadConfig();
const root = fileURLToPath(new URL("../", import.meta.url));
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
