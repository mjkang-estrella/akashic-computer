import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(root + "dist", { recursive: true });
await build({
  entryPoints: [root + "web/app.tsx"],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: root + "dist/app.js",
  minify: true,
});
const css =
  readFileSync(root + "../src/components/workspace/workspace.css", "utf8") +
  "\n" +
  readFileSync(root + "web/style.css", "utf8");
writeFileSync(root + "dist/style.css", css);
const html = readFileSync(root + "web/index.html", "utf8");
writeFileSync(root + "dist/index.html", html);
writeFileSync(
  root + "dist/widget.html",
  html
    .replace(
      /<link\s+rel="stylesheet"\s+href="\/style.css"\s*\/?>/,
      () => `<style>${css}</style>`,
    )
    .replace(
      '<script type="module" src="/app.js"></script>',
      () =>
        `<script>${readFileSync(root + "dist/app.js", "utf8").replaceAll("</script", "<\\/script")}</script>`,
    ),
);
const widget = readFileSync(root + "dist/widget.html", "utf8");
if (widget.includes('href="/style.css"') || widget.includes('src="/app.js"')) {
  throw new Error("MCP App assets were not inlined.");
}
const inlineScript = widget.match(/<script>([\s\S]*)<\/script>/)?.[1];
if (!inlineScript) throw new Error("MCP App script is missing.");
new Script(inlineScript); // Parse, without executing, the exact embedded payload.
console.log("Built standalone UI and self-contained MCP App.");
await build({
  entryPoints: [root + "src/mcp.mjs"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: root + "dist/mcp.cjs",
  banner: {
    js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;',
  },
  define: { "import.meta.url": "__import_meta_url" },
});
await build({
  entryPoints: [root + "src/server.mjs"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: root + "dist/controller.cjs",
  banner: {
    js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;',
  },
  define: { "import.meta.url": "__import_meta_url" },
});
