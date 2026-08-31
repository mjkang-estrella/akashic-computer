# Catalog Synchronization

Akashic uses Hugging Face webhooks for low-latency updates and a daily Convex
audit for recovery. Public reads come from the denormalized `catalogEntries`
table. Normalized family, release, size, variant, artifact, benchmark, source,
event, and run tables retain provenance and diagnostics.

Official vLLM Recipes are checked hourly at minute 15. A revision comparison
makes unchanged checks read-only; changed revisions synchronize compact,
versioned references without copying or regenerating launch commands.

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

3. Seed the production catalog before assigning the frontend Convex URL.

   ```bash
   npx convex run --prod seed:seedCurrentCatalog '{"secret":"<operator-secret>"}'
   npx convex run --prod catalog:listPublished '{}'
   ```

4. Set `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` in the
   frontend deployment to the values printed by Convex, then redeploy the
   frontend.

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
- Release, variant, artifact, and benchmark upserts use compound indexes instead
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
advance the base model's date, even when the model creator publishes them. The
daily audit gradually backfills legacy creator records that predate weight-level
provenance, with a per-source cap to avoid another expensive baseline pass.

## Recommended VRAM Semantics

When structured architecture metadata is available, default VRAM is the
checkpoint weight footprint plus a BF16 KV cache at the model's maximum context
length and concurrency 1. Runtime headroom is intentionally excluded. Standard
attention uses
layer count, KV heads, and head dimension. MLA checkpoints use their latent KV
width and only layers whose cache grows with context. The artifact retains the
weight-only minimum separately. Repositories without sufficient architecture
metadata keep the prior weight-based estimate and are labeled accordingly.

## Deployment Recipes And Run Reports

`recipeSync:syncVllmRecipes` reads the official model index, per-model JSON,
hardware taxonomy, and current `vllm-project/recipes` revision. Catalog entries
are linked only by exact Hugging Face artifact IDs. A recipe's semantic hash
excludes unrelated repository commits, so unchanged recipes generate no writes
when another recipe changes.

Evidence labels have narrow meanings:

- **Official vLLM recipe** means the official vLLM Recipes project publishes it.
- **Verified on hardware** appears only when upstream marks that profile
  `verified`.
- No recipe match means unverified, not unsupported.
- **Akashic run report** is a separate measurement tied to an exact artifact,
  runtime version, hardware profile, and optional recipe revision.

Run an immediate recipe refresh with:

```bash
npx convex run --prod admin:syncVllmRecipes '{"secret":"<operator-secret>"}'
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

Detailed model-card introductions are stored as protected catalog-entry
overrides. Each introduction contains a short disclosure summary, structured
highlights, paraphrased explanatory paragraphs, and an immutable source URL/SHA.
The override survives subsequent Hugging Face ingestion and is projected into
the public catalog snapshot without fetching a README in the browser.

## Validation

Automatic publication requires an approved source, recognized full-model
weights, structured model identity, parameter count, license, category, and
format. Provider artifacts also require structured `base_model` metadata.
Adapters, LoRAs, PEFT packages, checkpoints, demos, private repositories,
disabled repositories, unknown formats, and unresolved lineage are retained as
skipped source records but never published.

Benchmarks are imported only from structured `model-index` metadata. README
tables are never parsed. Protected `catalogOverrides` are merged last.

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

Inspect freshness and failures with:

```bash
npx convex run --prod catalog:status "{\"now\":$(node -p 'Date.now()')}"
```

Synchronize source configuration and start an immediate audit without reseeding
the public catalog:

```bash
npx convex run --prod admin:syncSourceConfig '{"secret":"<operator-secret>"}'
npx convex run --prod admin:seedFamily '{"secret":"<operator-secret>","familyId":"<family-id>"}'
npx convex run --prod admin:runAudit '{"secret":"<operator-secret>"}'
npx convex run --prod admin:cancelAudit '{"secret":"<operator-secret>","reason":"<reason>"}'
npx convex run --prod admin:checkHealth '{"secret":"<operator-secret>"}'
```

For secret rotation, set `HF_WEBHOOK_SECRET_PREVIOUS` to the old secret, update
the Hugging Face webhooks to the new `HF_WEBHOOK_SECRET`, confirm delivery, and
then remove the previous value.

The hourly health watchdog records state transitions in `catalogHealthAlerts`.
Set `CATALOG_ALERT_WEBHOOK_URL` to a Slack- or Discord-compatible incoming
webhook to receive transition notifications; otherwise transitions are emitted
to Convex logs.

An accepted webhook is stale after 10 minutes without processing. The catalog
is globally stale after 26 hours without a successful daily audit. The Convex
dashboard exposes `webhookEvents`, `syncRuns`, `sourceRepositories`, and their
skip/failure reasons for diagnosis.
