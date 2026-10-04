/** Local-only adapter for the handoff records. It never executes a benchmark or contacts a service. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { deploymentSchema } from "../src/lib/atlas/deployments";
import { evidenceSchema, parseEvidenceImport, type EvidenceReport } from "../src/lib/atlas/evidence";
import { artifactBuildKey } from "../src/lib/atlas/artifactBuilds";

export const groups = [
  { file: "benchmark-baseline.json", draft: 0, thinking: false, long: false },
  { file: "benchmark-mtp3.json", draft: 3, thinking: false, long: false },
  { file: "benchmark-mtp3-long.json", draft: 3, thinking: false, long: true },
  ...[1, 2, 3, 4, 5].map((draft) => ({ file: "benchmark-draft-sweep-" + draft + ".json", draft, thinking: false, long: false })),
  ...[2, 3].map((draft) => ({ file: "benchmark-draft-thinking-" + draft + ".json", draft, thinking: true, long: false })),
];
const provenanceSchema = z.object({
  model_repository: z.string(), model_revision: z.string().regex(/^[a-f0-9]{40}$/), model_file: z.string(),
  model_size_bytes: z.number().int().positive(), model_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  runtime_release: z.string(), runtime_asset: z.url(), runtime_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const rowSchema = z.object({
  case: z.union([z.string(), z.number()]), wall_seconds: z.number().nonnegative(),
  usage: z.object({ prompt_tokens: z.number().int(), completion_tokens: z.number().int(),
    prompt_tokens_details: z.object({ cached_tokens: z.number().int() }).optional() }),
  timings: z.object({ predicted_per_second: z.number().nonnegative(), prompt_per_second: z.number().nonnegative(),
    prompt_ms: z.number().nonnegative(), draft_n: z.number().int().optional(), draft_n_accepted: z.number().int().optional() }),
  finish_reason: z.enum(["length", "stop", "error", "unknown"]),
});
export function convertQwenRecords(input: {
  provenance: unknown; deployment: unknown; files: Record<string, unknown>; results?: unknown;
}): EvidenceReport[] {
  const p = provenanceSchema.parse(input.provenance), base = deploymentSchema.parse(input.deployment);
  if (base.buildKey !== artifactBuildKey(p.model_repository, p.model_revision, p.model_file) || base.artifactRepo !== p.model_repository)
    throw new Error("Deployment pin must match provenance.json exactly.");
  if (p.runtime_release !== "b11146" || base.runtime.name !== "llama.cpp" || base.runtime.backend !== "vulkan" || base.computer.platform !== "linux-x64")
    throw new Error("This adapter is only for the b11146 Framework Vulkan handoff.");
  const reports: EvidenceReport[] = [];
  for (const group of groups) {
    if (!(group.file in input.files)) continue;
    const rows = z.array(rowSchema).min(1).max(100).parse(input.files[group.file]);
    const id = group.file.replace(/\.json$/, "");
    const deployment = { ...base, id, runtime: { ...base.runtime, version: p.runtime_release,
      platform: "linux-x64" as const, archiveUrl: p.runtime_asset, archiveSha256: p.runtime_sha256 },
      settings: { ...base.settings, device: "Vulkan0", contextTokens: 262144, concurrency: 1,
        cacheK: "q8_0" as const, cacheV: "q8_0" as const, draftCacheK: "q8_0" as const, draftCacheV: "q8_0" as const,
        mtp: group.draft ? "draft-mtp" as const : "off" as const, draftMax: group.draft,
        thinking: group.thinking ? "on" as const : "off" as const, temperature: group.thinking ? 1 : 0, seed: 1234,
        topP: undefined, topK: undefined, flashAttention: "on" as const, offload: "all" as const,
        threads: 16, batch: 2048, ubatch: 512, chatTemplate: "embedded-jinja", reasoningFormat: "deepseek" as const } };
    const report = evidenceSchema.parse({ schemaVersion: 2, id: p.model_revision + ":" + id,
      modelSlug: base.modelSlug, artifactRepo: p.model_repository, buildKey: base.buildKey, kind: "performance",
      deployment, source: { label: id, origin: "local_import", limitations: [
        "Configuration protocol comes from the handoff; not every setting is recorded in each raw trial.",
        "Computer profile was supplied by the importer; no device inspection was performed.",
        "One trial per prompt; medians across different prompts are not statistical significance or an exhaustive optimum.",
        "Generated tokens include thinking when enabled. Token-limited answers were not checked for executable correctness.",
        "262144 tokens were allocated; full-context quality and stability and 1M context were not tested.",
        "No Q6/Q8 local quality or throughput A/B and no local KLD were measured.",
      ] }, protocol: { id: group.long ? "qwen-local-long-coding" : "qwen-local-three-coding-prompts",
        // The supplied handoff identifies these prompt sets. This is not a hash of unseen prompt text.
        promptSetId: group.long ? "qwen-local-handoff:43225-token-coding:v1" : "qwen-local-handoff:three-short-python-prompts:v1",
        tool: "llama.cpp API timing fields", toolVersion: p.runtime_release,
        cache: "disabled", aggregation: group.long ? "single-trial" : "median-across-prompts", repeatsPerPrompt: 1,
        ...(group.file.includes("draft-sweep") ? { order: ["3", "1", "5", "2", "4"] } : {}) },
      trials: rows.map((r) => ({ caseId: String(r.case), repetition: 0, promptTokens: r.usage.prompt_tokens,
        generatedTokens: r.usage.completion_tokens, cachedTokens: r.usage.prompt_tokens_details?.cached_tokens,
        decodeTps: r.timings.predicted_per_second, prefillTps: r.timings.prompt_per_second,
        prefillSeconds: r.timings.prompt_ms / 1000, wallSeconds: r.wall_seconds, finishReason: r.finish_reason,
        draftTokens: r.timings.draft_n, acceptedTokens: r.timings.draft_n_accepted })) });
    // This setup observation belongs to the initial MTP-3 setup, never to every sweep trial.
    if (group.file === "benchmark-mtp3.json" && input.results) {
      const snapshot = z.object({ system_memory_used_bytes: z.number().int().nonnegative(),
        swap_used_bytes: z.number().int().nonnegative(), timestamp: z.iso.datetime({ offset: true }) }).parse(input.results);
      report.memory = [{ kind: "snapshot", scope: "system", bytes: snapshot.system_memory_used_bytes,
        method: "MemTotal minus MemAvailable after setup; not continuously sampled",
        swapBytes: snapshot.swap_used_bytes, measuredAt: Date.parse(snapshot.timestamp) }];
      report.source.limitations.push("Whole-system setup memory snapshot, not model or process peak memory.");
    }
    reports.push(evidenceSchema.parse(report));
  }
  if (!reports.length) throw new Error("No supported benchmark JSON files found.");
  return reports;
}
async function main() {
  const { values } = parseArgs({ options: { "input-dir": { type: "string" }, deployment: { type: "string" }, output: { type: "string" } } });
  if (!values["input-dir"] || !values.deployment || !values.output)
    throw new Error("Usage: npx tsx scripts/convert-qwen-benchmarks.ts --input-dir DIR --deployment manifest.json --output NEW.json");
  const read = async (name: string) => JSON.parse(await readFile(resolve(values["input-dir"]!, name), "utf8"));
  const manifest = JSON.parse(await readFile(values.deployment, "utf8"));
  const files: Record<string, unknown> = {};
  for (const { file } of groups) {
    try { files[file] = await read(file); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
  let results: unknown;
  try { results = await read("results.json"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  const reports = convertQwenRecords({ provenance: await read("provenance.json"), deployment: manifest.configuration ?? manifest, files, results });
  const json = JSON.stringify(reports, null, 2), check = parseEvidenceImport(json);
  if (check.errors.length) throw new Error(check.errors.join("\n"));
  await writeFile(values.output, json + "\n", { flag: "wx", mode: 0o600 });
  console.log("Wrote " + reports.length + " private import records locally. Nothing was uploaded.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void main().catch((error) => { console.error(error.message); process.exitCode = 1; });
