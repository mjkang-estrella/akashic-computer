import type { ModelCategoryId } from "./types";

// Discovery focuses on general language and media models, not auxiliary systems.
const CATEGORIES = new Set<ModelCategoryId>([
  "language", "vision-documents", "image-generation", "audio-speech", "video-generation", "world-models",
]);
const SPECIALIST = /(?:^|[\s/_.-])(?:dory(?:\d|[\s/_.-]|$)|embed(?:ding)?s?|reranker?|reward|guard|safety|classifier|retriever|speculator|dflash)(?:[\s/_.-]|\d|$)/i;

export function isFocusedModel(identity: string, category?: ModelCategoryId): boolean {
  return (!category || CATEGORIES.has(category)) && !SPECIALIST.test(identity);
}
