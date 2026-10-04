import { artifactDownloadUrl, isPinnedRevision, safeArtifactPath, type ArtifactBuild } from "./artifactBuilds";
import { deploymentSchema, type DeploymentConfiguration } from "./deployments";
export const vulkanB11146 = {
  name: "llama.cpp", version: "b11146", backend: "vulkan" as const, platform: "linux-x64" as const,
  archiveUrl: "https://github.com/ggml-org/llama.cpp/releases/download/b11146/llama-b11146-bin-ubuntu-vulkan-x64.tar.gz",
  archiveSha256: "d3ce40fce7403cc93bcf5718fc46c6efb61ed9709f8e5d9f10c86bf0e30e8fb3",
};
const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
export function mergePiModels(current: Record<string, unknown>, provider: Record<string, unknown>) {
  const providers = current.providers;
  if (providers !== undefined && (!providers || typeof providers !== "object" || Array.isArray(providers)))
    throw new Error("Pi providers must be an object.");
  return { ...current, providers: { ...(providers as Record<string, unknown> ?? {}), "local-qwen": provider } };
}
export function mergePiSettings(current: Record<string, unknown>, model: string) {
  return { ...current, defaultProvider: "local-qwen", defaultModel: model };
}
/** Export only: never downloads, changes a service or writes Pi configuration. */
export function exportRecipe(raw: DeploymentConfiguration, build: ArtifactBuild, exercisedInputTokens?: number) {
  const d = deploymentSchema.parse(raw), s = d.settings;
  if (build.key !== d.buildKey || build.repo !== d.artifactRepo || !build.complete || !isPinnedRevision(build.revision) ||
    !build.files.length || build.files.some((f) => !f.sha256 || !/^[a-f0-9]{64}$/.test(f.sha256) || !safeArtifactPath(f.path)))
    throw new Error("Export requires a complete pinned artifact with SHA-256 for every file.");
  if (d.runtime.name !== "llama.cpp" || d.runtime.version !== "b11146" || d.runtime.platform !== "linux-x64" ||
    d.computer.platform !== "linux-x64" || d.runtime.backend !== "vulkan" || build.container !== "gguf")
    throw new Error("The first recipe exporter supports llama.cpp b11146 Vulkan on Linux x64 with GGUF.");
  if (!d.runtime.archiveSha256 || !d.runtime.archiveUrl ||
    !d.runtime.archiveUrl.startsWith("https://github.com/ggml-org/llama.cpp/releases/download/" + d.runtime.version + "/"))
    throw new Error("Pin an official llama.cpp release archive and SHA-256 before exporting.");
  if (s.mtp === "unknown" || s.thinking === "unknown" || s.flashAttention === "unknown" || s.offload !== "all" ||
    [s.cacheK, s.cacheV, s.draftCacheK, s.draftCacheV].includes("unknown") ||
    !s.threads || !s.batch || !s.ubatch || s.chatTemplate !== "embedded-jinja" || !s.reasoningFormat || s.reasoningFormat === "unknown")
    throw new Error("Specify all-layer offload, flash attention, cache formats, threads, batches, embedded Jinja and reasoning format.");
  if (s.mtp === "draft-mtp" && !s.draftMax) throw new Error("MTP needs a positive draft length.");
  const modelId = build.files[0].path.split("/").at(-1)!.replace(/\.gguf$/i, "");
  const args = ["--host", "127.0.0.1", "--port", "8080", "--alias", modelId, "--gpu-layers", "all", "--device", "Vulkan0", "--fit", "off", "--cache-ram", "0",
    "--ctx-size", String(s.contextTokens * s.concurrency), "--parallel", String(s.concurrency), "--flash-attn", s.flashAttention,
    "--cache-type-k", s.cacheK, "--cache-type-v", s.cacheV,
    "--batch-size", String(s.batch), "--ubatch-size", String(s.ubatch), "--threads", String(s.threads),
    "--jinja", "--reasoning-format", s.reasoningFormat,
    "--chat-template-kwargs", JSON.stringify({ enable_thinking: s.thinking === "on" })];
  for (const [key, flag] of [["temperature", "--temp"], ["seed", "--seed"], ["topP", "--top-p"], ["topK", "--top-k"]] as const)
    if (s[key] !== undefined) args.push(flag, String(s[key]));
  if (s.mtp === "draft-mtp") args.push("--spec-type", "draft-mtp", "--spec-draft-n-max", String(s.draftMax),
    "--spec-draft-type-k", s.draftCacheK, "--spec-draft-type-v", s.draftCacheV);
  else args.push("--spec-type", "none");
  const provider = { baseUrl: "http://127.0.0.1:8080/v1", api: "openai-completions", apiKey: "local",
    models: [{ id: modelId, name: modelId, reasoning: true, input: ["text"], contextWindow: s.contextTokens,
      maxTokens: Math.min(8192, s.contextTokens), cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] };
  const preparePi = [
    "// Stages backups and proposed files in a NEW directory; never modifies the originals.",
    "import { readFile, mkdir, writeFile } from 'node:fs/promises';",
    "import { join } from 'node:path';",
    "const [modelsPath, settingsPath, output] = process.argv.slice(2);",
    "if (!modelsPath || !settingsPath || !output) throw new Error('Usage: node prepare-pi.mjs EXISTING_MODELS EXISTING_SETTINGS NEW_OUTPUT_DIR');",
    "const [modelsText, settingsText] = await Promise.all([readFile(modelsPath, 'utf8'), readFile(settingsPath, 'utf8')]);",
    "const models = JSON.parse(modelsText), settings = JSON.parse(settingsText);",
    "const object = (v) => v && typeof v === 'object' && !Array.isArray(v);",
    "if (!object(models) || !object(settings) || (models.providers !== undefined && !object(models.providers))) throw new Error('Expected object configurations');",
    "const provider = " + JSON.stringify(provider) + ";",
    "const proposedModels = { ...models, providers: { ...models.providers, 'local-qwen': provider } };",
    "const proposedSettings = { ...settings, defaultProvider: 'local-qwen', defaultModel: " + JSON.stringify(modelId) + " };",
    "await mkdir(output, { mode: 0o700 });",
    "for (const [name, content] of Object.entries({ 'models.backup.json': modelsText, 'settings.backup.json': settingsText, 'models.proposed.json': JSON.stringify(proposedModels, null, 2), 'settings.proposed.json': JSON.stringify(proposedSettings, null, 2) })) await writeFile(join(output, name), content, { flag: 'wx', mode: 0o600 });",
    "console.log('Backups and proposed files prepared. Review before installing; original files were not changed.');",
  ].join("\n") + "\n";
  const downloads = ["#!/usr/bin/env bash", "set -euo pipefail",
    ': "$' + '{MODEL_DIR:?Set MODEL_DIR to a new download directory}"',
    'mkdir -p "$MODEL_DIR"', 'cd "$MODEL_DIR"'];
  for (const file of build.files) {
    const parent = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ".";
    downloads.push("mkdir -p -- " + quote(parent),
      "test ! -e " + quote(file.path) + " || { echo 'File already exists; verify it manually instead of overwriting.' >&2; exit 1; }",
      "curl --fail --location --proto '=https' --proto-redir '=https' --output " + quote(file.path) + " " + quote(artifactDownloadUrl(build, file)),
      "printf '%s\\n' " + quote(file.sha256 + "  " + file.path) + " | sha256sum --check -");
  }
  downloads.push("test ! -e runtime.tar.gz || { echo 'runtime.tar.gz already exists' >&2; exit 1; }",
    "curl --fail --location --proto '=https' --proto-redir '=https' --output runtime.tar.gz " + quote(d.runtime.archiveUrl),
    "printf '%s\\n' " + quote(d.runtime.archiveSha256 + "  runtime.tar.gz") + " | sha256sum --check -");
  const launch = ["#!/usr/bin/env bash", "set -euo pipefail",
    ': "$' + '{MODEL_DIR:?Set MODEL_DIR}"', ': "$' + '{RUNTIME_DIR:?Set RUNTIME_DIR to the extracted, verified runtime}"',
    'exec "$RUNTIME_DIR/llama-server" --model "$MODEL_DIR"/' + quote(build.files[0].path) + " " + args.map(quote).join(" ")].join("\n") + "\n";
  const manifest = { schemaVersion: 1, kind: "exported-llama.cpp", configuration: d, artifact: build,
    exercisedInputTokens: exercisedInputTokens ?? null, qualityValidatedContextTokens: null,
    unsupported: ["Vision projector not included", "Extended/1M context not validated"],
    warnings: [build.mtp === "unknown" && s.mtp === "draft-mtp" ? "MTP inclusion is unverified in the catalog manifest" : null,
      "Throughput is not answer correctness or time to useful answer"].filter(Boolean) };
  return {
    "manifest.json": JSON.stringify(manifest, null, 2), "download.sh": downloads.join("\n") + "\n", "launch.sh": launch,
    "akashic-selected.service": ["[Unit]", "Description=Akashic selected local model", "", "[Service]",
      "EnvironmentFile=%h/.config/akashic-selected/runtime.env", "ExecStart=%h/.local/share/akashic-selected/launch.sh",
      "Restart=on-failure", "RestartSec=5", "", "[Install]", "WantedBy=default.target", ""].join("\n"),
    "runtime.env.example": "MODEL_DIR=/absolute/path/to/verified/models\nRUNTIME_DIR=/absolute/path/to/extracted/runtime\n",
    "pi-provider.json": JSON.stringify({ providers: { "local-qwen": provider } }, null, 2),
    "pi-settings.patch.json": JSON.stringify({ defaultProvider: "local-qwen", defaultModel: modelId }, null, 2),
    "prepare-pi.mjs": preparePi,
    "README.txt": [
      "Review manifest.json before running anything. Export does not apply configuration.",
      "Use a new download directory; download.sh refuses to overwrite existing files. Verify the runtime archive before extracting it.",
      "Install launch.sh in ~/.local/share/akashic-selected and configure ~/.config/akashic-selected/runtime.env using runtime.env.example.",
      "Make launch.sh executable (chmod 700). Back up any existing akashic-selected files before installing replacements.",
      "Check that port 8080 is available before starting. Do not stop or replace existing inference services automatically.",
      "The optional systemd unit is a separate service. Enable it explicitly only after testing launch.sh.",
      "Back up Pi models.json and settings.json. Merge only providers.local-qwen and the two default-setting keys; retain other providers and thinking preferences.",
      "Optional: node prepare-pi.mjs EXISTING_MODELS_JSON EXISTING_SETTINGS_JSON NEW_OUTPUT_DIR stages backups and proposed merged files without changing the originals. Review the proposals before installing them.",
      "Validate /health, a streaming completion, and a harmless tool-call exchange before selecting the new provider.",
      "Rollback: stop the new service, restore the saved Pi files, and retain the downloaded artifacts and evidence.",
      "Configured context: " + s.contextTokens + ". Largest recorded input: " + (exercisedInputTokens ?? "unknown") + ". Full-context quality is unverified.",
      "No 1M context or vision support is promised.",
    ].join("\n") + "\n",
  };
}
