# Catalog Synchronization

Akashic uses Hugging Face webhooks for low-latency updates and a daily Convex
audit for recovery. Public reads come from the denormalized `catalogEntries`
table. Normalized family, release, size, variant, artifact, benchmark, source,
event, and run tables retain provenance and diagnostics.

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

Inspect freshness and failures with:

```bash
npx convex run --prod catalog:status '{}'
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
