import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fixtureBuild, fixtureDeployment } from "../../../test/deploymentFixture";
import { exportRecipe, mergePiModels, mergePiSettings, vulkanB11146 } from "./recipeExports";
import { deploymentMatchKey, withWorkloadConstraints } from "./deployments";
const deployment = { ...fixtureDeployment, runtime: vulkanB11146, settings: { ...fixtureDeployment.settings,
  mtp: "draft-mtp" as const, draftMax: 3, offload: "all" as const, flashAttention: "on" as const,
  threads: 16, batch: 2048, ubatch: 512, chatTemplate: "embedded-jinja", reasoningFormat: "deepseek" as const,
  device: "Vulkan0", temperature: 1, seed: 1234 } };
describe("pinned exports", () => {
  it("exports valid shell with the b11146 flags and distinguishes exercised context", () => {
    const files = exportRecipe(deployment, fixtureBuild, 43225);
    const manifest = JSON.parse(files["manifest.json"]);
    expect(manifest.exercisedInputTokens).toBe(43225);
    expect(manifest.qualityValidatedContextTokens).toBeNull();
    expect(files["download.sh"]).toContain("sha256sum --check");
    const folder = mkdtempSync(join(tmpdir(), "akashic-recipe-"));
    try {
      for (const name of ["launch.sh", "download.sh"] as const) {
        writeFileSync(join(folder, name), files[name]);
        execFileSync("bash", ["-n", join(folder, name)]);
      }
      // A fake executable verifies argument boundaries without inference or downloads.
      writeFileSync(join(folder, "llama-server"), "#!/bin/bash\nprintf '%s\\n' \"$@\"\n", { mode: 0o700 });
      const args = execFileSync("bash", [join(folder, "launch.sh")], { env: { ...process.env,
        MODEL_DIR: "/tmp/model dir with 'quotes'", RUNTIME_DIR: folder }, encoding: "utf8" }).trim().split("\n");
      expect(args).toContain("/tmp/model dir with 'quotes'/model-Q8_0.gguf");
      expect(args.slice(args.indexOf("--spec-draft-n-max"), args.indexOf("--spec-draft-n-max") + 2)).toEqual(["--spec-draft-n-max", "3"]);
      expect(args).toContain("--spec-draft-type-k");
      expect(args).toContain('{"enable_thinking":true}');
      expect(args).toContain("--fit");
      writeFileSync(join(folder, "prepare-pi.mjs"), files["prepare-pi.mjs"]);
      const originalModels = JSON.stringify({ providers: { spark: { name: "Existing" } } });
      const originalSettings = JSON.stringify({ thinkingLevel: "high" });
      writeFileSync(join(folder, "models.json"), originalModels);
      writeFileSync(join(folder, "settings.json"), originalSettings);
      execFileSync(process.execPath, [join(folder, "prepare-pi.mjs"), join(folder, "models.json"), join(folder, "settings.json"), join(folder, "prepared")]);
      expect(readFileSync(join(folder, "models.json"), "utf8")).toBe(originalModels);
      expect(JSON.parse(readFileSync(join(folder, "prepared/models.proposed.json"), "utf8")).providers.spark).toEqual({ name: "Existing" });
      expect(readFileSync(join(folder, "prepared/settings.backup.json"), "utf8")).toBe(originalSettings);
      expect(JSON.parse(readFileSync(join(folder, "prepared/settings.proposed.json"), "utf8")).thinkingLevel).toBe("high");
    } finally { rmSync(folder, { recursive: true }); }
  });
  it("rejects incomplete pins, unsupported binaries and preserves Pi providers/preferences", () => {
    expect(() => exportRecipe(deployment, { ...fixtureBuild, complete: false })).toThrow("complete pinned");
    expect(() => exportRecipe({ ...deployment, runtime: { ...vulkanB11146, platform: "linux-arm64" } }, fixtureBuild)).toThrow("Linux x64");
    const prior = { providers: { spark: { baseUrl: "http://example.invalid/v1" } }, custom: 42 };
    expect(mergePiModels(prior, { models: [] }).providers).toMatchObject({ spark: prior.providers.spark });
    expect(prior.providers).not.toHaveProperty("local-qwen");
    expect(mergePiSettings({ thinkingLevel: "high", other: 1 }, "model")).toMatchObject({ thinkingLevel: "high", other: 1 });
    expect(JSON.parse(exportRecipe(deployment, fixtureBuild)["manifest.json"]).exercisedInputTokens).toBeNull();
  });
  it("refuses unsupported context, missing sampling settings and absent MTP", () => {
    expect(() => exportRecipe({ ...deployment, settings: { ...deployment.settings, contextTokens: 1048576 } }, fixtureBuild)).toThrow("native context");
    expect(() => exportRecipe(deployment, { ...fixtureBuild, architecture: undefined })).toThrow("native context");
    expect(() => exportRecipe({ ...deployment, settings: { ...deployment.settings, seed: undefined } }, fixtureBuild)).toThrow("temperature, seed");
    expect(() => exportRecipe({ ...deployment, settings: { ...deployment.settings, temperature: undefined } }, fixtureBuild)).toThrow("temperature, seed");
    expect(() => exportRecipe(deployment, { ...fixtureBuild, mtp: "absent" })).toThrow("no MTP");
    const files = exportRecipe({ ...deployment, settings: { ...deployment.settings, device: "Vulkan1" } }, fixtureBuild);
    expect(files["launch.sh"]).toContain("'--device' 'Vulkan1'");
    expect(files["launch.sh"]).toContain("'--temp' '1' '--seed' '1234'");
    expect(files["README.txt"]).toContain("systemctl --user");
    expect(files["README.txt"]).toContain("pinned b11146 defaults");
  });
  it("keeps measured thinking/context when only workload targets and reserve change", () => {
    const measured = { ...deployment, settings: { ...deployment.settings, thinking: "off" as const } };
    const changed = withWorkloadConstraints(measured, { ...measured.workload, thinking: "on", contextTokens: 1048576,
      concurrency: 2, totalMemoryBytes: 70e9, reserveBytes: 8200000000 });
    expect(deploymentMatchKey(changed)).toBe(deploymentMatchKey(measured));
    const files = exportRecipe(changed, fixtureBuild, 43225);
    expect(files["launch.sh"]).toContain('{"enable_thinking":false}');
    expect(JSON.parse(files["pi-provider.json"]).providers["local-qwen"].models[0].reasoning).toBe(false);
    expect(files["launch.sh"]).toContain("'--ctx-size' '262144'");
    expect(JSON.parse(files["manifest.json"]).exercisedInputTokens).toBe(43225);
  });
});
