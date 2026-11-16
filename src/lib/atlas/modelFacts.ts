/**
 * Display helpers for the model header. Catalog values arrive as Hugging Face license ids
 * and model-card prose; these keep the header short without changing the stored data.
 */

const LICENSE_NAMES: Record<string, string> = {
  mit: "MIT",
  "apache-2.0": "Apache 2.0",
  gemma: "Gemma",
  "openmdw-1.1": "OpenMDW 1.1",
  other: "Custom license",
};

/** A readable license name, or null when the license is unknown. */
export function licenseLabel(license: string): string | null {
  const value = license.trim();
  if (!value || value.toLowerCase() === "unknown") return null;
  const known = LICENSE_NAMES[value.toLowerCase()];
  if (known) return known;
  // Already written for people, e.g. "NVIDIA Open Model" or "MNPL".
  if (/[A-Z\s]/.test(value)) return value;
  const llama = value.match(/^llama(\d+(?:\.\d+)?)$/);
  if (llama) return `Llama ${llama[1]}`;
  const creativeCommons = value.match(/^cc-([a-z-]+)-(\d+\.\d+)$/);
  if (creativeCommons) return `CC ${creativeCommons[1].toUpperCase()} ${creativeCommons[2]}`;
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Trims a model-card highlight to its essentials: the parameter split instead of a prose
 * architecture line, plain comma lists, no repeat of the label, and token counts as numbers.
 */
export function compactFact(label: string, value: string): string {
  let text = value.trim();
  if (/architecture|parameters/i.test(label)) {
    // "Multimodal MoE · 320B total / 18B active" → "320B total / 18B active".
    const counts = text.split(/\s+·\s+/).filter((part) => /\d+(?:\.\d+)?\s*[BMT]\b/.test(part));
    if (counts.length > 0) text = counts.join(" · ");
  }
  // "Text, image, and video" → "Text, image, video".
  text = text.replace(/,?\s+and\s+(?=[^,]+$)/i, ", ");
  // "30T-token multimodal corpus" → "30T tokens".
  text = text.replace(/^(\d+(?:\.\d+)?[KMBT])-token\b.*$/i, "$1 tokens");
  // "KDA linear attention + NoPE sparse MLA" under "Attention" → "KDA linear + NoPE sparse MLA".
  const labelWord = label.trim().toLowerCase();
  if (labelWord && !labelWord.includes(" ")) {
    const without = text.replace(new RegExp(`\\s*\\b${labelWord}\\b`, "gi"), "").replace(/\s{2,}/g, " ").trim();
    if (without) text = without;
  }
  return text;
}
