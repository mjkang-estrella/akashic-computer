function quote(value) {
  if (/[\r\n\0]/.test(value)) throw new Error("Invalid service path");
  return `"${value.replaceAll("%", "%%").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
export function systemdUnit({ node, entry, root, stateDir }) {
  if (!root.startsWith("/") || /[\r\n\0]/.test(root))
    throw new Error("Invalid service path");
  return `[Unit]
Description=Akashic Computer LAN controller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${root.replaceAll("%", "%%")}
ExecStart=${quote(node).replaceAll("$", () => "$$")} ${quote(entry).replaceAll("$", () => "$$")}
Environment=${quote(`AKASHIC_STATE_DIR=${stateDir}`)}
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=default.target
`;
}
