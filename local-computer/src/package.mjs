import { mkdirSync, copyFileSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stateDir } from "./config.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const marketplace = join(stateDir, "marketplace");
const dest = join(marketplace, "plugins/akashic-local");
mkdirSync(join(marketplace, ".agents/plugins"), { recursive: true });
mkdirSync(dest, { recursive: true });
for (const file of ["plugin.json", "mcp.json", ".mcp.json", "README.md"])
  copyFileSync(join(root, file), join(dest, file));
for (const dir of [".codex-plugin", "dist", "skills"])
  cpSync(join(root, dir), join(dest, dir), { recursive: true });
writeFileSync(
  join(marketplace, ".agents/plugins/marketplace.json"),
  JSON.stringify(
    {
      name: "akashic-personal",
      interface: { displayName: "Akashic Computer Personal" },
      plugins: [
        {
          name: "akashic-local",
          source: { source: "local", path: "./plugins/akashic-local" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Developer tools",
        },
      ],
    },
    null,
    2,
  ),
);
console.log(`Private plugin package prepared at ${dest}`);
console.log(
  `Register marketplace: codex plugin marketplace add '${marketplace}'`,
);
console.log("Install plugin: codex plugin add akashic-local@akashic-personal");
