/**
 * Short tags that tell apart artifact rows which would otherwise read the same: one provider
 * uploading several checkpoints in one format (a QAT build, a draft model). Tags come from
 * the parts of the repository name that differ within that group; unique rows get none.
 */

interface TaggableRow {
  repo: string;
  format: string;
  provider: string;
}

const WORDS: Record<string, string> = {
  qat: "QAT",
  assistant: "Assistant",
  draft: "Draft",
  instruct: "Instruct",
  it: "IT",
  pt: "PT",
  mlx: "MLX",
  awq: "AWQ",
  gptq: "GPTQ",
  eagle: "EAGLE",
  mtp: "MTP",
};

/** Name parts that say nothing a row does not already show. */
const NOISE = new Set(["unquantized", "ct", "hf", "gguf", "safetensors", "weights", "model"]);

const tokens = (repo: string) =>
  (repo.split("/").pop() ?? repo).split(/[-.]/).map((token) => token.trim()).filter(Boolean);

function word(token: string): string {
  const lower = token.toLowerCase();
  if (WORDS[lower]) return WORDS[lower];
  if (/^w\d+a\d+$/i.test(token) || /^q\d+(?:_[a-z0-9]+)*$/i.test(token) || /^int\d+$/i.test(token)) return token.toUpperCase();
  const bits = lower.match(/^(\d+)bit$/);
  if (bits) return `${bits[1]}-bit`;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * `variant` is the variant the table is showing (e.g. "IT"); repeating it in a tag adds
 * nothing, so it is left out unless two rows would then read the same again.
 */
export function disambiguationTags(rows: TaggableRow[], variant?: string): Map<string, string> {
  const groups = new Map<string, TaggableRow[]>();
  for (const row of rows) {
    const key = `${row.format.toLowerCase()}|${row.provider.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const tags = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const split = group.map((row) => tokens(row.repo));
    const shared = new Set(
      split[0].map((token) => token.toLowerCase())
        .filter((token) => split.every((parts) => parts.some((part) => part.toLowerCase() === token))),
    );
    const tagFor = (index: number, dropVariant: boolean) => {
      const format = group[index].format.toLowerCase();
      return split[index]
        .filter((token) => {
          const lower = token.toLowerCase();
          return !shared.has(lower) && !NOISE.has(lower) && lower !== format &&
            !(dropVariant && variant && lower === variant.toLowerCase());
        })
        .map(word)
        .join(" ");
    };
    const short = group.map((_, index) => tagFor(index, true));
    const collides = new Set(short.filter((tag, index) => short.indexOf(tag) !== index));
    group.forEach((row, index) => {
      const tag = collides.has(short[index]) ? tagFor(index, false) : short[index];
      if (tag) tags.set(row.repo, tag);
    });
  }
  return tags;
}
