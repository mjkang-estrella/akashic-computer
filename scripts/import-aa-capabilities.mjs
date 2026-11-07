/** Manual import of public page chart data. Reads saved HTML; never calls an API. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const [input, retrievedAt, intelligenceIndexVersion, sourceUrl] = process.argv.slice(2);
if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt ?? "") || !/^\d+\.\d+\.\d+$/.test(intelligenceIndexVersion ?? "") || !sourceUrl?.startsWith("https://artificialanalysis.ai/")) {
  throw new Error("Usage: node scripts/import-aa-capabilities.mjs saved-page.html YYYY-MM-DD INDEX_VERSION SOURCE_URL");
}
const html = readFileSync(input, "utf8");
const payload = [...html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/g)]
  .map(match => JSON.parse(match[1]))
  .filter(value => Array.isArray(value) && typeof value[1] === "string")
  .map(value => value[1]).join("");
const candidates = new Map();
function visit(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.id === "string" && typeof value.slug === "string" && "livecodebench" in value) candidates.set(value.id, value);
  Object.values(value).forEach(visit);
}
for (const line of payload.split("\n")) {
  const raw = line.slice(line.indexOf(":") + 1);
  // RSC also carries non-JSON text and module rows. Never evaluate those.
  try { visit(JSON.parse(raw)); } catch { /* Ignore non-JSON rows. */ }
}
const anchors = new Set(["gpt-6-luna", "gemini-3-8-flash", "claude-haiku-5-5", "gpt-6-astra", "claude-opus-5-5", "gemini-4-carbon"]);
const fields = ["id", "slug", "name", "releaseDate", "isOpenWeights", "parameters", "modelWeightsSourceUrl", "effort", "release", "intelligenceIndex", "terminalBench40", "hleDiamond", "gpqa", "livecodebench"];
const models = [...candidates.values()].filter(row => row.modelWeightsSourceUrl || anchors.has(row.slug))
  .map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null])));
if (!models.length) throw new Error("No public chart data found; existing snapshot left untouched.");
for (const row of models) {
  for (const field of ["intelligenceIndex", "terminalBench40", "hleDiamond", "gpqa", "livecodebench"]) {
    const value = row[field];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (field === "intelligenceIndex" ? 100 : 1))) throw new Error(`Invalid ${field} for ${row.slug}`);
  }
}
const snapshot = { sourceUrl, retrievedAt, intelligenceIndexVersion, sourceSha256: createHash("sha256").update(html).digest("hex"), models };
writeFileSync(new URL("../src/lib/atlas/snapshots/artificial-analysis.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Imported ${models.length} configurations. Review changed scores, index version, checkpoint URLs, and peer groups before committing.`);
