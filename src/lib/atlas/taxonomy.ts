import type {
  Family,
  ModelCapabilityId,
  ModelCategoryId,
  Release,
  SizeNode,
} from "./types";

export type { ModelCapabilityId, ModelCategoryId } from "./types";

export const MODEL_CATEGORIES: { id: ModelCategoryId; label: string }[] = [
  { id: "language", label: "Language" },
  { id: "vision-documents", label: "Vision & Documents" },
  { id: "image-generation", label: "Image Generation" },
  { id: "video-generation", label: "Video Generation" },
  { id: "audio-speech", label: "Audio & Speech" },
  { id: "retrieval", label: "Retrieval & Embeddings" },
  { id: "3d-spatial", label: "3D & Spatial" },
  { id: "world-models", label: "World Models" },
  { id: "robotics", label: "Robotics" },
];

export const MODEL_CAPABILITIES: { id: ModelCapabilityId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "reasoning", label: "Reasoning" },
  { id: "coding", label: "Coding" },
  { id: "mathematics", label: "Mathematics" },
  { id: "science", label: "Science" },
  { id: "agentic", label: "Agentic / Tool Use" },
  { id: "long-context", label: "Long Context" },
  { id: "multilingual", label: "Multilingual" },
  { id: "ocr", label: "OCR" },
  { id: "image-understanding", label: "Image Understanding" },
  { id: "video-understanding", label: "Video Understanding" },
  { id: "document-qa", label: "Document QA" },
  { id: "image-generation", label: "Image Generation" },
  { id: "image-editing", label: "Image Editing" },
  { id: "video-generation", label: "Video Generation" },
  { id: "speech-recognition", label: "Speech Recognition" },
  { id: "text-to-speech", label: "Text to Speech" },
  { id: "music", label: "Music" },
  { id: "embedding", label: "Embedding" },
  { id: "reranking", label: "Reranking" },
  { id: "3d-generation", label: "3D Generation" },
  { id: "robot-control", label: "Robot Control" },
  { id: "world-modeling", label: "World Modeling" },
];

function contextTokens(value: string): number {
  const match = value.toUpperCase().match(/([\d.]+)\s*([KM])/);
  if (!match) return 0;
  const amount = Number(match[1]);
  return match[2] === "M" ? amount * 1_000_000 : amount * 1_000;
}

export function taxonomyFor(
  family: Family,
  release: Release,
  size: SizeNode,
): { category: ModelCategoryId; capabilities: ModelCapabilityId[] } {
  const identityText = [
    family.id,
    family.name,
    release.id,
    release.name,
    size.label,
    ...size.variants,
  ]
    .join(" ")
    .toLowerCase();
  const text = `${identityText} ${family.tags.toLowerCase()}`;

  const clearlyVisual =
    (family.id === "gemma" && release.id !== "codegemma" && size.label !== "1B") ||
    (family.id === "llama" && release.id === "l4") ||
    family.id === "inkling" ||
    identityText.includes("multimodal") ||
    identityText.includes("vision");
  const category: ModelCategoryId =
    size.category ??
    release.category ??
    family.category ??
    (clearlyVisual ? "vision-documents" : "language");
  const capabilities = new Set<ModelCapabilityId>();
  const codeFocused = /(coder|codegemma|codestral|devstral|\bcode\b)/.test(text);

  if (!codeFocused) capabilities.add("general");
  if (/reason|thinking|\br1\b/.test(text)) capabilities.add("reasoning");
  if (codeFocused || text.includes("coding")) capabilities.add("coding");
  if (/math|mathemat/.test(text)) capabilities.add("mathematics");
  if (/science|scientific/.test(text)) capabilities.add("science");
  if (/agentic|tool use|tools/.test(text)) capabilities.add("agentic");
  if (contextTokens(size.context ?? release.ctx) >= 128_000) {
    capabilities.add("long-context");
  }
  if (text.includes("multilingual")) capabilities.add("multilingual");
  if (clearlyVisual) capabilities.add("image-understanding");
  if (text.includes("ocr")) capabilities.add("ocr");
  if (/document qa|document understanding/.test(text)) capabilities.add("document-qa");

  for (const capability of family.capabilities ?? []) capabilities.add(capability);
  for (const capability of release.capabilities ?? []) capabilities.add(capability);
  for (const capability of size.capabilities ?? []) capabilities.add(capability);

  return { category, capabilities: [...capabilities] };
}
