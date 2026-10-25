# Catalog Synchronization

Akashic uses Hugging Face webhooks for low-latency updates and a daily Convex
audit for recovery. Model lists read lean summaries from
`catalogSnapshotChunks`; model pages read full records from `catalogEntries`.
Normalized family, release, size, variant, artifact, source, event, and run
tables retain the fields used for reconciliation and diagnostics.

Official vLLM Recipes are checked hourly at minute 15. Official SGLang
cookbooks are checked daily at 04:15 UTC because their source lives in the much
larger SGLang monorepo. Revision comparisons make unchanged checks read-only.
Changed revisions synchronize compact, versioned references without copying or
regenerating launch commands.

## Incremental snapshots and I/O diagnostics

Every catalog write updates a compact `catalogSummaries` row in the same
transaction. Changed summaries mark one of 128 stable slug-based buckets dirty.
Snapshot publication reads only dirty buckets and rewrites only changed chunks;
list responses sort by timestamp independently of bucket membership. Detail-only
changes, such as introductions and reports, do not rewrite summary chunks.

The first snapshot refresh after deploying this schema backfills summaries in
pages of at most 100 rows, with a 1 MB read budget. It persists its cursor and
schedules continuation automatically. The previous complete snapshot stays
visible until the migration and publication finish. The next audit/update starts
this automatically, or an operator can run the existing `admin:refreshCatalogSnapshot`
action. New write paths must use the insert/patch/delete helpers in
`convex/catalogSnapshot.ts`; direct database imports after migration require a
controlled summary backfill before publication.

Public health subscriptions use a shared minute timestamp that advances while
the page is open, allowing visitors in the same minute to share query results.
Time-derived health can lag a boundary by up to one minute.

Set the Convex environment variable `LOG_DATABASE_IO=true` to log transaction
bytes and documents read/written for snapshot publication and workspace I/O.
The log payload contains counters and operation names, not catalog records,
messages, or credentials. Leave it unset in normal operation; use the same
fixtures/workloads before and after changes when comparing metrics.

## Site cache revalidation

The Next.js site renders catalog pages from cached Convex reads and serves them
as ISR. Each read carries a cache tag (`src/lib/atlas/cacheTags.ts`): one per
model (page, feed and social images), `catalog:list` for pages built from the
published list (home, benchmarks, models, sitemap), and `catalog:changes` for
recent material changes (home, site feed). Cached pages keep only data that
changes with the catalog itself; snapshot revision and sync time are left to
the live browser subscription, so a sync that changes nothing public leaves
every cached page byte-identical.

Convex queues a tag when public data actually changes: a model's payload
(through the catalog write helpers), a published summary chunk, or a new
material change. `convex/siteRevalidation.ts` posts model tags to the site's
`/api/revalidate` route a minute after the first change, batching a sync or
audit into one request. List-wide tags wait for the hourly flush at minute 45,
which also retries anything a failed request left queued. Pages regenerate on
their next visit; time-based revalidation after one day is only a safety net.

Deployments without `CATALOG_REVALIDATE_URL` and `CATALOG_REVALIDATE_SECRET`,
such as development, queue nothing.

## Production Setup

1. Deploy the Convex functions.

   ```bash
   npx convex deploy
   ```

2. Set production secrets. `HF_TOKEN` is optional for public repositories but
   recommended for rate limits and gated metadata.

   ```bash
   npx convex env set --prod HF_WEBHOOK_SECRET '<shared-secret>'
   npx convex env set --prod HF_TOKEN '<hugging-face-token>'
   npx convex env set --prod CATALOG_ADMIN_SECRET '<operator-secret>'
   ```

   Site cache revalidation needs a secret shared with the frontend, which reads
   it as `CATALOG_REVALIDATE_SECRET`:

   ```bash
   npx convex env set --prod CATALOG_REVALIDATE_URL 'https://akashic.computer/api/revalidate'
   npx convex env set --prod CATALOG_REVALIDATE_SECRET '<revalidate-secret>'
   ```

3. Synchronize the source configuration and run the first audit before assigning
   the frontend Convex URL.

   ```bash
   npx convex run --prod admin:syncSourceConfig '{"secret":"<operator-secret>"}'
   npx convex run --prod admin:runAudit '{"secret":"<operator-secret>"}'
   npx convex run --prod catalog:listPublished '{}'
   ```

4. Set `NEXT_PUBLIC_CONVEX_URL` in the frontend deployment to the cloud URL
   printed by Convex, and `CATALOG_REVALIDATE_SECRET` to the value given to
   Convex, then redeploy the frontend.

## Hugging Face Webhooks

Create account-level webhooks in Hugging Face settings. Hugging Face does not
currently support organization-owned webhook objects, but a user webhook can
watch selected public organizations and repositories. Every webhook targets:

```text
https://<deployment>.convex.site/webhooks/huggingface
```

Use the same value as `HF_WEBHOOK_SECRET`, and enable repository-related
events only (`repo`, `repo.content`, and `repo.config`).

- **Akashic NVIDIA:** `nvidia` only. NVIDIA acts as both creator and provider.
- **Akashic Unsloth:** `unsloth` only.
- **Akashic language creators:** approved language-model organizations listed
  in `convex/sourceConfig.ts`, including Poolside and excluding NVIDIA.
- **Akashic specialized creators:** approved image, video, audio, robotics, and
  world-model organizations listed in `convex/sourceConfig.ts`.

The endpoint verifies `X-Webhook-Secret`, ignores non-model and non-main-branch
activity, deduplicates by repository identity/scope/action/SHA, and coalesces a
30-second upload burst into one repository refresh. Configure another webhook
before any webhook reaches 800 events in 24 hours; Hugging Face caps each
webhook at 1,000 daily triggers.

Do not include an organization in multiple webhooks. Duplicate delivery is safe
but unnecessarily consumes the trigger allowance of both webhooks.

Use the Hugging Face webhook Activity page and replay control for initial
verification. A replay of an already processed SHA is recorded as an
idempotent no-op.

## Database I/O Profile

- The first audit after adding a source hydrates every repository whose SHA is
  not yet recorded. This is the expensive baseline pass, not the expected daily
  cost.
- Later audits compare the Hub list SHA with `sourceRepositories.headSha` and
  hydrate only new or changed repositories. Replayed or unchanged webhook
  events exit before catalog reconciliation.
- Known creator and provider repositories resolve through the indexed artifact,
  variant, and size graph. A family-wide catalog read is reserved for a genuinely
  new model identity that has no existing repository or `base_model` link.
- Release, variant, and artifact upserts use compound indexes instead
  of post-query filters. In steady state, `applyRepoResult` I/O should scale with
  one changed model and its artifacts rather than the total entries in its
  family.
- After each daily audit, compare `latestAudit.changed` with
  `latestAudit.discovered`. A large changed count is expected for a newly
  monitored source; repeated large counts indicate missing or unstable Hub SHAs
  and should be investigated before increasing audit frequency.

## Last Updated Semantics

The public model `Last Updated` date means the newest significant change to its
canonical full-model weights. During ingestion, Akashic reads the repository
tree at the immutable head SHA, hashes the paths, sizes, and object IDs of
recognized weight blobs, and records the newest per-file weight commit. README,
model-card, configuration, discussion, and other description-only changes do
not advance the public date.

Quantizations retain their own weight update timestamps, but they do not
advance the base model's date, even when the model creator publishes them.

## Recommended VRAM Semantics

When structured architecture metadata is available, default VRAM is the
checkpoint weight footprint plus a BF16 KV cache at the model's maximum context
length and concurrency 1. Runtime headroom is intentionally excluded. Standard
attention uses
layer count, KV heads, and head dimension. MLA checkpoints use their latent KV
width and only layers whose cache grows with context. The artifact retains the
weight-only minimum separately. Repositories without sufficient architecture
metadata keep the prior weight-based estimate and are labeled accordingly.

The model page scales the stored native-context KV estimate to the visitor's
selected context (8K, 32K, 128K or native; 32K by default). The growing-cache
formula is linear in tokens, so this is the same formula evaluated at a shorter
length. New sessions start without a memory budget, so no artifact is judged
until the visitor chooses hardware or a total; a chosen budget is remembered in
local storage. With a budget and context, an artifact is flagged only when
weights alone, or weights plus the BF16 KV estimate at that context, exceed it.
List summaries still use the native-context total for the homepage count.

## Deployment Recipes And Run Reports

`deploymentRecipeSync:syncVllm` reads the official model index, per-model JSON,
hardware taxonomy, and current `vllm-project/recipes` revision.
`deploymentRecipeSync:syncSglang` reads the official cookbook navigation, MDX
pages, and imported literal configuration objects from `sgl-project/sglang` at
an immutable revision. The SGLang parser uses Acorn and never executes upstream
JavaScript. Catalog entries link to recipes only through exact Hugging Face
artifact IDs.

Each recipe has a semantic content hash. An upstream revision can change
without rewriting unchanged recipe rows. SGLang hardware is labeled
`verified` only when its cookbook cell carries `verified: true`; other listed
hardware remains `documented`.

Evidence labels have narrow meanings:

- **Official vLLM recipe** means the official vLLM Recipes project publishes it.
- **Official SGLang recipe** means the official SGLang cookbook publishes it.
- **Verified on hardware** appears only when the corresponding upstream source
  marks that profile verified.
- No recipe match means unverified, not unsupported.
- **Akashic run report** is a separate measurement tied to an exact artifact,
  runtime version, hardware profile, and optional recipe revision.

Run an immediate recipe refresh with:

```bash
npx convex run --prod admin:syncDeploymentRecipes '{"secret":"<operator-secret>"}'
```

Publish a measured report only after preserving its evidence artifact:

```bash
npx convex run --prod admin:publishRunReport '{
  "secret":"<operator-secret>",
  "reportId":"dgx-spark-example-2026-08-15",
  "modelSlug":"<catalog-slug>",
  "artifactRepo":"<org/repo>",
  "hardwareProfile":"DGX Spark (GB10)",
  "runtime":"vLLM",
  "runtimeVersion":"<version>",
  "verificationStatus":"measured",
  "testedAt":1786752000000,
  "notes":"<workload semantics and result notes>",
  "evidenceUrl":"<durable-evidence-url>",
  "published":true
}'
```

Setting `published` to `false` retracts the report from the public payload while
retaining its operator record. Recipe synchronization never creates a run
report or infers performance.

## Material Changes

`materialChanges` records model publication, weight-manifest updates, new
artifacts, expanded runtime metadata, access changes, and official recipe
changes. Dedupe keys make webhook replays idempotent. Documentation-only
commits are excluded because public dates and weight changes use the recognized
weight manifest rather than repository `lastModified`.

## Protected Model Introductions

Detailed model-card introductions are stored in the typed `modelIntroductions`
table. Each introduction contains a short disclosure summary, structured
highlights, paraphrased explanatory paragraphs, and an immutable source URL/SHA.
Ingestion reapplies the introduction to the matching model detail record.

## Validation

Automatic publication requires an approved source, recognized full-model
weights, structured model identity, parameter count, license, category, and
format. Provider artifacts also require structured `base_model` metadata.
Adapters, LoRAs, PEFT packages, checkpoints, demos, private repositories,
disabled repositories, unknown formats, and unresolved lineage are retained as
skipped source records but never published.

Benchmark evidence is accepted only from structured `model-index` metadata.
README tables are never parsed.

## Recovery And Status

`convex/crons.ts` starts a complete source audit every day at 03:30 UTC. Each
source is listed independently, changed SHAs are hydrated, and missing
repositories require three audit misses before removal. A failed source marks
the run degraded and leaves its existing public records intact.

Freshness is calculated per enabled organization. A source is current for 26
hours after its latest successful audit. The catalog is `degraded` when some
sources are delayed but at least one source remains current. It is `stale` only
when no enabled source is current. Failed sources keep their last known good
entries.

Hugging Face `429` and server errors use `Retry-After` or
`X-RateLimit-Reset` when supplied. Other retries use bounded exponential delay.
The source record stores its failure count and next retry time so the Convex
dashboard and homepage status show what is actually waiting.

Only transient Hugging Face errors fail a whole source. A repository that fails
for its own reasons (malformed metadata, a bound, an identity-repair invariant)
is skipped, logged as `Audit skipped <repo>: <reason>`, and summarized in the
run message; it keeps its prior SHA, so the next audit retries it. Configs are
read through `resolve/` so Git LFS-stored `config.json` files parse, and
trailing commas or `NaN` are tolerated; an unparseable config falls back to the
API's structured subset. An exact-file build that exceeds 256 shards (or a
repository with more than 256 build groups) is omitted whole rather than
truncated, logged as `Exact-file manifest omitted`, and stays at
repository-estimate level in comparisons.

Every 15 minutes `sync:recoverStalledWebhooks` re-schedules pending webhook
events whose processing ended without settling them (for example an action
timeout). Events waiting on a scheduled retry are left alone, and an event that
stalls three times is marked `failed`.

Inspect freshness and failures with:

```bash
npx convex run --prod catalog:status "{\"now\":$(node -p 'Date.now()')}"
```

Synchronize source configuration and start an immediate audit without reseeding
the public catalog:

```bash
npx convex run --prod admin:syncSourceConfig '{"secret":"<operator-secret>"}'
npx convex run --prod admin:runAudit '{"secret":"<operator-secret>"}'
npx convex run --prod admin:cancelAudit '{"secret":"<operator-secret>","reason":"<reason>"}'
npx convex run --prod admin:checkHealth '{"secret":"<operator-secret>"}'
```

For secret rotation, set the new `HF_WEBHOOK_SECRET` in Convex and immediately
update every Hugging Face webhook to the same value.

The hourly health watchdog records state transitions in `catalogHealthAlerts`.
Set `CATALOG_ALERT_WEBHOOK_URL` to a Slack- or Discord-compatible incoming
webhook to receive transition notifications; otherwise transitions are emitted
to Convex logs.

An accepted webhook is stale after 10 minutes without processing. The catalog
is globally stale when no monitored source has succeeded in 26 hours. The Convex
dashboard exposes `webhookEvents`, `syncRuns`, `sourceRepositories`, and their
skip/failure reasons for diagnosis.
