import { describe, expect, it } from "vitest";
import { compactFact, licenseLabel } from "./modelFacts";

describe("license labels", () => {
  it("names common Hugging Face license ids", () => {
    expect(licenseLabel("mit")).toBe("MIT");
    expect(licenseLabel("apache-2.0")).toBe("Apache 2.0");
    expect(licenseLabel("Apache-2.0")).toBe("Apache 2.0");
    expect(licenseLabel("cc-by-nc-sa-4.0")).toBe("CC BY-NC-SA 4.0");
    expect(licenseLabel("llama3.1")).toBe("Llama 3.1");
    expect(licenseLabel("openmdw-1.1")).toBe("OpenMDW 1.1");
    expect(licenseLabel("other")).toBe("Custom license");
    expect(licenseLabel("minimax-music3-community")).toBe("Minimax Music3 Community");
  });

  it("keeps names already written for people and hides unknown licenses", () => {
    expect(licenseLabel("NVIDIA Open Model")).toBe("NVIDIA Open Model");
    expect(licenseLabel("MNPL")).toBe("MNPL");
    expect(licenseLabel("Unknown")).toBeNull();
    expect(licenseLabel("")).toBeNull();
  });
});

describe("compact model facts", () => {
  it("shortens the GLM-5.3-Flash model-card highlights", () => {
    expect(compactFact("Architecture", "Multimodal MoE · 320B total / 18B active")).toBe("320B total / 18B active");
    expect(compactFact("Modalities", "Text, image, and video")).toBe("Text, image, video");
    expect(compactFact("Attention", "KDA linear attention + NoPE sparse MLA")).toBe("KDA linear + NoPE sparse MLA");
    expect(compactFact("Pretraining", "30T-token multimodal corpus")).toBe("30T tokens");
    expect(compactFact("Deployment", "vLLM, SGLang, TokenSpeed, KTransformers")).toBe("vLLM, SGLang, TokenSpeed, KTransformers");
  });

  it("leaves values it cannot shorten safely", () => {
    expect(compactFact("Architecture", "Dense transformer")).toBe("Dense transformer");
    expect(compactFact("Attention", "Attention")).toBe("Attention");
    expect(compactFact("Modalities", "Text and image")).toBe("Text, image");
  });
});
