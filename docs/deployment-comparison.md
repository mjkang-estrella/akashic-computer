# Hardware-specific deployment comparison

This optional workflow complements neutral catalog discovery. The unit of comparison is a checkpoint, exact artifact revision/file set, runtime/backend/version, computer, and settings. A decision stores up to four configurations, workload constraints, evidence references, and a rationale. There is no universal quality score, confirmed-fit badge, or requirement to benchmark every quantization.

The scope incorporates the user's decision to rely on available **KLD / Top-1 agreement** and published base-model capability evidence. Automated benchmark jobs, exhaustive quantized task evaluations, and arbitrary controller commands are deferred. No benchmark execution capability was added to the controller.

## Implementation boundaries A–G

| Area | Implementation | Dependency |
| --- | --- | --- |
| A: Exact files | `artifactBuilds`, revision/path identities, shard completeness, bytes, separately typed LFS SHA-256 / Git OID, lineage, format/precision and MTP evidence. MLX uses structured precision; unknown formats stay unknown. | Existing ingestion/reconciliation |
| B: Memory | Main KV with independent K/V formats, block overhead, hybrid layers, distinct weights/recurrent/draft/workspace/reserve. Known subtotal never becomes total RAM. | A; architecture config |
| C: Accounts | GitHub numeric identity; optional any-GitHub signup; member/admin, suspension, web/connector ownership checks and quotas. | Connected workspace |
| D: Profiles | Owner-scoped versioned computer/workload records: memory pools/limits, devices, topology, backends/environment, task/latency/context constraints. Comparisons keep snapshots. | C |
| E: Evidence | Additive V2 records in existing `runReports`; strict JSON preview/import, exact subject validation, private defaults, idempotence, public projection/consent/admin review. | A, C, D |
| F: Comparison | `/compare`, `/compare/[id]`; exact files, persistent decisions, configuration copies, alignment, unknowns, rationale and relevant material changes. | A–E |
| G: Recipes | Export-only pinned b11146 Vulkan Linux x64 downloads, manifest, launcher, separate systemd unit, Pi fragments, backup/rollback instructions. | A, D, F |

The foundation is the connected-workspace changes through `f898bf7`, cherry-picked onto the isolated comparison branch. The original branch, draft PR, main checkout and live inference configuration remain independent. The hypothetical precision calculator was ported from discovery `f19b1fd`, preserving `left`, `right`, `leftBpw`, `rightBpw`, and `budget` URL parameters. Its budget remains **weights only**. A scenario does not imply an exact artifact.

## Identity, memory, compatibility

`ArtifactBuild.key` is encoded lowercase repository + pinned commit + exact file/shard group. Multiple Q6/Q8 files in one repo remain selectable. Repository records/links remain unresolved estimates. Historical pins survive source renames via a source-repository foreign key, while respecting later source privacy. File lists load lazily with pagination; the public snapshot stays compact. The picker can include recorded historical revisions, so a README-only commit does not make an evidence-bearing pin inaccessible. Unrecorded revisions require catalog metadata before exact evidence can attach.

The hybrid fixture has 40 main layers (10 full, 30 linear), 2 KV heads, head dimension 256 and 262144 tokens per slot. BF16 main KV is **5,368,709,120 bytes**; Q8_0 main KV is **2,852,126,720 bytes**, including 34 bytes per 32-element block. These are KV components, not total runtime memory. MTP prediction layers are separate from main layers. Unknown recurrent/draft/workspace allocations are never silently zeroed. Download bytes are a resident-weight proxy, not an observed allocation.

Memory is stored in bytes and displayed in decimal GB and GiB. Physical capacity, usable system memory, GPU-addressable limits and the user's ceiling are separate. Templates describe hardware classes, not observed user devices. A 60 GB budget does not create a 60 GB GPU. Runtime platform/backend mismatches are surfaced, but matching labels do not prove support.

Configured context is **per slot**; concurrency multiplies estimated cache and exported llama.cpp total `--ctx-size`. Native context, configured target, largest observed input, and full-context quality remain distinct. Extended context stays unverified; no 1M support is inferred from allocation flags.

## Evidence contract and privacy

The canonical application schema is `src/lib/atlas/evidence.ts`; Convex validators mirror it in `convex/comparisonValues.ts`. `/docs/deployment-comparison` is the user guide. Selected options download identity-populated fidelity/performance templates; null placeholders must be replaced or removed before import.

- Base-model capability remains published creator evidence, never a selected-quantization test.
- Fidelity accepts KLD, Top-1 with explicit fraction/percent units, uncertainty and reference/dataset/tokenizer/tool/protocol details. Missing details are allowed but prevent controlled comparisons. Without `buildKey`, a record remains repository-level context. Comparison cards expose same-catalog-model evidence for other or unpinned artifacts in a separate context-only section; it never enters selected-file metrics or sorting.
- Performance requires an exact deployment and trials. Input/output counts, cache, prefill/decode/TTFT/wall time, stop reason, thinking/sampling, MTP/draft acceptance and repetitions remain separate. Unmeasured fields are omitted.
- Memory explicitly records snapshot/peak, scope, method and bytes. A peak requires sampling interval and duration. V2 cannot silently relabel a setup snapshot as a peak.
- Alignment checks reference/protocol or hardware/runtime/non-varied settings and prompt/output identity. It is descriptive, not a significance test. One trial per different prompt yields no established winner. Numeric sorting does not establish causality. Unknown values and options with several reports for a metric retain their positions outside numeric ranking. Each matching performance report remains visible with its own protocol; no speed is aggregated across workloads. Largest measured input and memory observations use all matching reports, including in recipe exports. Failed trials are excluded from throughput summaries.

Limits: 1 MiB / 100 reports per batch; 64 KiB / 100 trials per report; 1,000 imported reports/account; 10 inserting batches/hour. IDs are unique **within an account**. Identical re-import is unchanged; conflicting content rejects the transaction. An account counter avoids scanning all report bodies. Workload edits change targets only; they do not rewrite a measured option’s context, concurrency or thinking settings. Applying a computer profile to existing options is explicit. Bookkeeping and memory observations do not detach evidence, while changed processors, drivers, placement or topology do.

Profiles/comparisons allow 100 of each type and 120 writes/hour. Connector enrollment allows 10/hour and 10 active controllers; conversation/job creation allows 60/hour. Server enforcement is transactional.

Private operations derive ownership from authentication, never a supplied owner ID. Public evidence returns only the consented projection. Publication removes configuration ID/label and profile names but may retain hardware/environment details: the owner sees the **exact projection** before submission. An administrator must separately publish it. Withdrawal removes the projection. Saved references to deleted/withdrawn evidence remain removable by the owner. Legacy publication APIs cannot overwrite V2 imports.

Saved-ID URLs remain private. Public shortlist URLs contain artifact keys only, excluding personal profiles/settings/evidence/rationale. Unsaved choices stay in memory while browsing catalog routes, without silent local-storage writes. Saving is explicit.

## Local-only handoff conversion

The adapter reads only named benchmark JSON files, `provenance.json`, and optional setup `results.json`. It never runs benchmark scripts, inspects devices, contacts inference, or reads Pi sessions. It excludes answers, raw responses and incidental paths. A supplied deployment/recipe manifest identifies the computer snapshot and catalog subject; the provenance pin must match. Handoff b11146/Vulkan/context/cache/batch/thread settings are explicit; unrecorded sampling details stay unknown. Prompt-set IDs are source-described by this handoff; they are not hashes inferred from case IDs or token counts.

```bash
npx tsx scripts/convert-qwen-benchmarks.ts \
  --input-dir /path/to/existing/qwen-local-records \
  --deployment /path/to/reviewed-manifest.json \
  --output /path/to/new-private-evidence.json
```

Output uses mode 0600 and refuses overwrite. Nothing uploads; preview/import it separately while signed in. Real device records are not bundled or public seeds.

The synthetic adapter regression fixture covers ten reports / 28 trials and preserves these handoff expectations: baseline **53.1587** tok/s; initial MTP-3 **74.9650**; 43225-input MTP-3 **51.3652**, with **57.4154 s** prefill / **752.8468** input tok/s. Draft 1–5 medians: 66.6689, 74.8656, 75.5864, 70.4575, 70.9897. Thinking-on draft 2/3: 65.3186 / 63.9930. These numbers are regression expectations, not seeded evidence about the synthetic device.

Limitations: three different short prompts rather than repeated trials; all outputs capped at 512; thinking tokens included when enabled; no executable correctness evaluation; only ~43K filled context tested; no 1M endpoint; no local Q6/Q8 A/B or KLD. The **54,735,187,968-byte** memory observation is a whole-system setup snapshot with zero swap, not a process peak. The ~1–2% thinking-mode MTP 2/3 gap establishes no universal winner. AesSedai KLD does not attach to Unsloth artifacts; KLD is not an intelligence percentage.

## Rollout and migrations (not performed here)

1. Review/test against a separate Convex development deployment. Existing accounts, repository artifacts, legacy `runReports`, sessions and connected deployments remain intact. Tables/fields are additive. Legacy report fields become optional only in storage; existing API inputs stay required.
2. Configure OAuth using the connected-workspace guide. `WORKSPACE_ACCESS_MODE=github` enables any GitHub account; absent mode preserves the legacy owner gate. Keep `ALLOWED_GITHUB_USER_ID` for initial admin. Sessions/connectors check suspension. Identity conflicts reject rather than link by email.
3. Rehydrate exact metadata with internal `artifactBuilds:refreshBatch`. It schedules bounded repository refreshes, downloads no weights, and adds no cron. Ingest stores manifests even when older catalog projections are unchanged. Repository comparison stays available during backfill.
4. Enable `NEXT_PUBLIC_DEPLOYMENT_COMPARISON=true` only after backend functions/schema and metadata are ready. `NEXT_PUBLIC_CONNECTED_WORKSPACE` remains independent. Verify real OAuth and two-account isolation on staging before production signup.
5. First coverage: Framework/Spark templates, Qwen3.6 35B Q6/Q8 exact manifests, a dense alternative, and privately imported available evidence. Missing Q6/Spark/task measurements are not launch blockers.

No V2 records have been deployed. `importedReportCount` starts at zero because pre-V2 accounts have no private imports. Any experimental deployment already containing V2 imports must recount this field before rollout. There is no destructive migration or automatic publication.

Recipe export requires a known native context, a target within that context, explicit temperature/seed/runtime device, and MTP not explicitly absent. Remaining sampler options use the pinned runtime defaults and are listed in the export instructions. The unit is explicitly a user service. Export stages Pi proposals with a replacement warning if `local-qwen` already exists.

Rollback: disable the web flag and, if needed, restore single-owner access. Preserve additive tables/pins and private records. Existing catalog/companion interfaces remain available.

## Verification

```bash
npm ci
npx convex codegen --system-udfs --typecheck disable  # local generation only
npm run typecheck
npm run lint
npm test
npm run build
npm ci --prefix local-computer
npm run build --prefix local-computer
npm run typecheck --prefix local-computer
npm test --prefix local-computer
```

Build the companion UI before its HTTP test. A disposable browser backend runs actual Convex functions through `convex-test`:

```bash
npx vitest run --config test/preview.config.mts
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3218 \
NEXT_PUBLIC_DEPLOYMENT_COMPARISON=true NEXT_PUBLIC_CONNECTED_WORKSPACE=true \
npm run dev -- --port 3100
```

The harness uses synthetic data and simulated authentication. It cannot publish evidence or invoke a controller. State disappears when stopped. For a browser on another machine, explicitly set `PREVIEW_HOST` to the development interface and use the same host in the web build and set `AKASHIC_DEV_ORIGIN` to that hostname/IP for Next development assets; never use real data in this harness. This does not verify OAuth delivery or deployed schema migration; those require staging. No deployment is part of this implementation.

### Local verification record

- 110 web/backend tests; TypeScript, ESLint, local Convex generation and the Next production build pass.
- Companion build, typecheck and all 22 tests pass. No controller changes or live inference actions were needed.
- T3 browser DOM checks at desktop and 390 px mobile: same-repository Q6/Q8 selection, private JSON preview/import, KLD/Top-1 and performance references, save/reopen with retained references, profile saving, export preview, unknown measurements after settings change, public pin URLs and legacy scenario URLs. No horizontal overflow was found. Sign-out clears private in-memory state. T3 screenshots of the revised comparison, workload constraints, evidence and export flow were captured using disposable synthetic records only.
- Existing handoff files were converted and validated **in memory only**: 10 reports / 28 trials, original medians preserved, setup memory still a snapshot. No actual records were added to a database or a fixture server.
- Next.js / its ESLint config were patched to 16.3.8 and Auth.js core to 0.41.3 following their [Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) and [Auth.js](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-x445-f3h2-j279) advisories. `npm audit --omit=dev` reports zero vulnerabilities. Six inherited high-severity findings remain in development lint/glob dependencies; resolving those requires separate dependency work rather than npm's suggested downgrade of the Next lint configuration.

Real OAuth round trips, backend deployment/schema migration, and reproducing exported inference recipes on hardware were not run. They remain explicit staging/operator validation, not claims supported by the synthetic preview.
