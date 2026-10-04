import { z } from "zod";
export const shortText = z.string().trim().min(1).max(200);
export const bytesSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const tokens = z.number().int().positive().max(16_777_216);
const backend = z.enum(["vulkan", "cuda", "rocm", "metal", "cpu", "unknown"]);
const platform = z.enum(["linux-x64", "linux-arm64", "mac-arm64", "windows-x64", "unknown"]);
export const cacheSchema = z.enum(["bf16", "f16", "q8_0", "q4_0", "unknown"]);
const httpUrl = z.url().max(2048).refine((s) => /^https?:\/\//.test(s), "Use an HTTP(S) URL");
export const computerSchema = z.object({
  name: shortText, revision: z.number().int().positive(), platform,
  cpu: shortText.optional(), backends: z.array(backend).max(8),
  devices: z.array(z.object({ id: shortText, name: shortText, architecture: shortText.optional() }).strict()).max(16),
  pools: z.array(z.object({
    id: shortText, label: shortText, kind: z.enum(["unified", "host", "device"]),
    capacityBytes: bytesSchema.optional(), usableBytes: bytesSchema.optional(),
    accessibleBytes: bytesSchema.optional(), deviceIds: z.array(shortText).max(16),
  }).strict()).max(20),
  topology: z.string().max(500).optional(),
  source: z.enum(["manual", "observed", "template"]),
  observedAt: z.number().nonnegative().optional(),
  environment: z.object({ os: shortText.optional(), kernel: shortText.optional(),
    driver: shortText.optional(), powerProfile: shortText.optional() }).strict().optional(),
}).strict();
export const workloadSchema = z.object({
  name: shortText, revision: z.number().int().positive(),
  taskFocus: z.enum(["general", "coding", "reasoning", "long-context", "other"]),
  totalMemoryBytes: bytesSchema.refine((n) => n > 0), contextTokens: tokens,
  concurrency: z.number().int().min(1).max(256),
  thinking: z.enum(["on", "off", "unknown"]),
  reserveBytes: bytesSchema.optional(),
  desiredDecodeTps: z.number().positive().optional(), desiredTtftSeconds: z.number().positive().optional(),
}).strict();
export const runtimeSchema = z.object({
  name: shortText, version: shortText, backend, platform,
  archiveUrl: httpUrl.optional(), archiveSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export const settingsSchema = z.object({
  device: shortText.optional(),
  contextTokens: tokens, concurrency: z.number().int().min(1).max(256),
  cacheK: cacheSchema, cacheV: cacheSchema, draftCacheK: cacheSchema, draftCacheV: cacheSchema,
  mtp: z.enum(["off", "draft-mtp", "unknown"]), draftMax: z.number().int().min(0).max(32),
  thinking: z.enum(["on", "off", "unknown"]), temperature: z.number().min(0).max(5).optional(),
  seed: z.number().int().optional(), topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().nonnegative().optional(),
  flashAttention: z.enum(["on", "off", "unknown"]),
  offload: z.enum(["all", "partial", "cpu", "unknown"]),
  threads: z.number().int().min(1).max(1024).optional(),
  batch: z.number().int().positive().max(1_048_576).optional(),
  ubatch: z.number().int().positive().max(1_048_576).optional(),
  chatTemplate: shortText.optional(),
  reasoningFormat: z.enum(["deepseek", "none", "unknown"]).optional(),
}).strict();
export const deploymentSchema = z.object({
  id: shortText, label: shortText, buildKey: z.string().min(1).max(1600),
  modelSlug: shortText, artifactRepo: shortText,
  runtime: runtimeSchema, computer: computerSchema, workload: workloadSchema, settings: settingsSchema,
}).strict();
export type ComputerProfile = z.infer<typeof computerSchema>;
export type WorkloadProfile = z.infer<typeof workloadSchema>;
export type DeploymentConfiguration = z.infer<typeof deploymentSchema>;
export const defaultWorkload: WorkloadProfile = {
  name: "Local coding", revision: 1, taskFocus: "coding", totalMemoryBytes: 80e9,
  contextTokens: 262144, concurrency: 1, thinking: "on",
};
/** Templates state hardware class, never observations of a user's actual computer. */
export const computerTemplates: Record<string, ComputerProfile> = {
  generic: { name: "Memory budget only", revision: 1, platform: "unknown", backends: [], devices: [],
    pools: [], source: "template" },
  framework: { name: "Framework Desktop", revision: 1, platform: "linux-x64",
    cpu: "Ryzen AI MAX+ 395", backends: ["vulkan"], source: "template",
    devices: [{ id: "gpu0", name: "Radeon 8060S", architecture: "gfx1151" }],
    pools: [{ id: "shared", label: "Unified system memory — enter actual limits", kind: "unified", deviceIds: ["gpu0"] }] },
  spark: { name: "DGX Spark", revision: 1, platform: "linux-arm64", backends: ["cuda"], source: "template",
    devices: [{ id: "gpu0", name: "GB10" }],
    pools: [{ id: "shared", label: "Per-node unified memory — enter actual limits", kind: "unified", deviceIds: ["gpu0"] }],
    topology: "Single node; interconnect and additional devices unconfirmed" },
};
export function configurationId(): string {
  // getRandomValues also supports a local HTTP preview outside a secure context.
  return "deployment-" + Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("");
}
export function defaultDeployment(buildKey: string, modelSlug: string, artifactRepo: string, label: string): DeploymentConfiguration {
  return { id: configurationId(), buildKey, modelSlug, artifactRepo, label,
    computer: computerTemplates.generic, workload: defaultWorkload,
    runtime: { name: "unknown", version: "unknown", backend: "unknown", platform: "unknown" },
    settings: { contextTokens: 262144, concurrency: 1, cacheK: "q8_0", cacheV: "q8_0",
      draftCacheK: "q8_0", draftCacheV: "q8_0", mtp: "off", draftMax: 0,
      thinking: "on", flashAttention: "unknown", offload: "unknown" } };
}
export function stableJson(value: unknown): string {
  const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v;
  return JSON.stringify(stable(value));
}
export function deploymentMatchKey(d: DeploymentConfiguration) {
  return stableJson({ buildKey: d.buildKey, runtime: d.runtime, computer: performanceComputer(d.computer), settings: d.settings });
}
/** Profile bookkeeping and memory observations do not identify a different processor. */
export function performanceComputer(p: ComputerProfile) {
  return { platform: p.platform, cpu: p.cpu, devices: p.devices, backends: [...p.backends].sort(), environment: p.environment, topology: p.topology,
    pools: p.pools.map((pool) => ({ kind: pool.kind, deviceIds: [...pool.deviceIds].sort() })) };
}
export function decimalGbToBytes(value: string): number { return Math.round(Number(value) * 1e9); }
export function withWorkloadConstraints(d: DeploymentConfiguration, workload: WorkloadProfile): DeploymentConfiguration {
  return { ...d, workload };
}
export function compatibilityNotes(d: DeploymentConfiguration): string[] {
  const notes: string[] = [];
  if (d.runtime.platform !== "unknown" && d.computer.platform !== "unknown" && d.runtime.platform !== d.computer.platform)
    notes.push("Runtime binary platform does not match this computer.");
  if (d.runtime.backend !== "unknown" && d.computer.backends.length && !d.computer.backends.includes(d.runtime.backend))
    notes.push("Backend is not listed for this computer.");
  if (d.runtime.version === "unknown") notes.push("Runtime version is not pinned.");
  notes.push("Hardware capacity alone does not verify runtime support.");
  return notes;
}
