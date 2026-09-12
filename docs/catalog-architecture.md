# Catalog architecture

The catalog separates upstream transport, domain reconciliation, durable work,
and public reads. Adding a source should not require adding another audit loop.

## Boundaries

- `sourceConfig.ts` defines approved organizations, roles, and family rules.
  Synchronize that configuration through the existing operator endpoint.
- `huggingFaceClient.ts` owns authenticated HTTP requests, immutable revision
  reads, pagination validation, optional configuration enrichment, and retry
  timing. Parsing and classification live in `src/lib/atlas/huggingface.ts`.
- `catalogIngestion.ts` owns the ingestion transaction shared by webhooks and
  audits. `catalogReconciliation.ts` supplies identity and payload operations.
  Registered endpoints in `sync.ts` delegate to those domain functions.
- `auditState.ts` owns audit creation and exactly-once source completion.
  `audit.ts` owns leased workers and checkpoints; `auditValues.ts` centralizes
  validators and operational bounds.
- `published.ts` normalizes legacy stored payloads at the storage boundary.
  Domain code and public responses always receive the three evidence arrays,
  even when old records omitted them.
- `catalogSnapshot.ts` publishes lean list chunks. Detail reads use full
  catalog entries and resolve identity-repair aliases.

## Durable audit flow

Each enabled source receives one job, with three phases: list one Hub page,
process its repositories one at a time, then reconcile missing repositories.
The job retains only the current page (at most 100 repositories), its cursor,
position, counters, retry state, and lease token. Three indexed
`sourceAuditLeases` bound upstream work to three source steps at a time. Each
source uses a stable worker lane and claims one small lease document, avoiding
a shared read range over frequently changing job payloads. Changed repository
steps are paced by one second; unchanged checkpoints continue immediately
without upstream requests.
Source starts are staggered.

A mutation claims a five-minute lease before an action makes HTTP requests.
Each checkpoint checks both the active run and lease token. Catalog writes and
the repository checkpoint commit in the same transaction. Checkpoints schedule
their continuation in that transaction, so progress cannot commit without its
next worker. A five-minute recovery cron reschedules due jobs and expired
leases. Late workers cannot overwrite a newer checkpoint or write after
another source takes their expired lane. Capacity deferrals and recovery
starts are staggered; failed claim transactions retry without waiting for the
recovery cron.

Retries resume the same page or repository. After three failures, a bad
repository is recorded and the worker continues through the organization.
Incomplete listings and failed repository hydration never run removal sweeps.
Completed source results update freshness and run totals once and publish
partial work while other organizations continue. Legacy or six-hour abandoned
runs are cancelled and replaced; cancelled workers cannot modify the catalog.

Removal requires three distinct successful audit misses. Replayed sweeps count
once per run, and an update seen after the audit began prevents removal.

## Identity and migrations

The normalized family/release/size/variant/artifact graph resolves known
repositories with indexes. A bounded family search handles new identities.
Source records retain the Hub's stable repository ID when it is available;
audit hydration and webhook updates use that identity to track renames, with
repository-name lookup as a fallback for older records.
Moving the sole artifact out of an incorrect derived entry retires that entry
and stores an alias to its corrected identity, preserving existing URLs.
Underlying source evidence remains in its original tables.

New fields on existing tables are optional to permit deployment against the
live database. Read normalization supports records predating evidence arrays;
ingestion writes the canonical payload as repositories change. New audit jobs
and aliases use separate validated tables rather than overloading catalog
payloads with operational state.

Source repositories carry an optional ingestion version. Older versions
rehydrate once even when their commit SHA is unchanged, so identity repairs
and parser migrations cannot be bypassed by the normal fast path. Raise that
version deliberately when an ingestion change needs existing sources
reprocessed, and widen the schema validator before changing its value.

## Expansion

For another Hub organization, add its source rule and family metadata, sync
configuration, and run an audit. Existing sources continue independently.
For another upstream service, implement its transport and classifier, then
call the shared ingestion transaction rather than copying reconciliation.
Review explicit source, page, family, and artifact bounds before expanding
beyond the existing policies. A policy failure must retain prior entries and
report a failed source; it must never silently truncate a deletion scan.

Run `npm test`, `npm run typecheck`, and `npm run lint`, deploy to the existing
Convex deployment, and smoke-test an audit before treating backend work as
complete. Tests cover legacy payloads, identity repair, lease replay,
independent retries, concurrency bounds, and duplicate removal protection.
