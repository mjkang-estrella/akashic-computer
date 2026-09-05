# Model identity and memory evidence

A family groups related releases. A catalog entry identifies a release and size;
its artifacts retain their variants. Creator checkpoints match the complete
normalized release/size identity. Neither direction of substring matching is
allowed. A stored source-repository link does not override conflicting identity.
Provider artifacts require complete, unambiguous structured base-model lineage
and the same model stem after removing recognized precision/variant suffixes.
Renamed derivatives and multi-base merges are held for review rather than
silently becoming quantizations of a parent. New variants retain their own names;
existing curated variants sharing a repository remain intact.

Runtime recipes are separate from downloadable checkpoints. A recipe is shown
only when an exact repository ID occurs among the selected variant's artifacts.
Recipe variant minimums apply to that precision and recipe configuration, not
all runtimes. The upstream recipe is the source for topology and workload details.

Weight estimates and BF16 KV-cache estimates are separate. KV estimates state
context length and concurrency; they exclude runtime workspace and other state.
A total memory budget does not describe device count, per-device memory,
interconnect, runtime support or offloading. No budget produces a confirmed
runtime-fit verdict. A budget below the weight estimate establishes only a
weight deficit. Repository-level GGUF estimates are not exact file estimates.

Full detail hydration preserves original trust, confidence, memory bounds and
benchmark values. Comparison fetches only the selected models' details, not the
lossy catalog summaries. Equal memory bounds render as one value. Missing deltas
render as one summary, never zero. Existing delta records lack evaluation
protocol and BF16 reference identifiers, so any populated deltas appear in a
separate disclosure as unaligned evidence, not a comparison table.

## Repairing historical links

The internal `sync:refreshRepository` action re-fetches a monitored repository
and its weight metadata even when its revision is unchanged. Reconciliation
moves a conflicting artifact atomically, withdraws the old normalized link,
and preserves its underlying record. It does not automatically move the last
artifact out of a model. Source material-history and run-report records remain
stored; the old detail projection drops evidence belonging to moved artifacts.

On 2026-09-04, reingestion moved these repositories out of
`glm-glm-5-3-flash-321b` into `glm-glm-5-3-753b`:

- `zai-org/GLM-5.3`
- `zai-org/GLM-5.3-BF16`
- `unsloth/GLM-5.3`
- `unsloth/GLM-5.3-GGUF`

Flash retained five artifacts. The regular GGUF heuristic was recomputed using
753B rather than 321B parameters. Recipe synchronization then refreshed exact
links for both models. These are catalog corrections, not measured runtime
benchmarks or verified GGUF download-file requirements.
