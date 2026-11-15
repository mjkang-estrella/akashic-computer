# Akashic Computer v2: a better front-end for the Hugging Face Hub

## Why v2

v1 began as "the Hugging Face UI is hard to browse." It then turned into a
curated catalog synced into Convex, plus a deployment-comparison tool, a
connected workspace with chat, a local-computer MCP plugin, and accounts.
Each piece holds up on its own. Together they no longer amount to a better way
to browse the Hub.

v2 goes back to that first goal. **Akashic is a read-only lens over the live
Hub. It makes models easier to find and their relationships easier to see.**
There is no curated catalog to maintain and no publisher allowlist.

## The problem

Reviewed on 2026-11-04 from screenshots of the live Hub (logged out,
1440x900) plus API checks. Three independent reviews (GPT-6-Astra,
Grok 4.7, Fable 5.1) all reached the same core problem.

**For someone who wants to run a model locally, the Hub finds the right repo
and then stops helping.** Search usually ranks the official repo first.
Every step after that click (which package, from whom, which file, will it
fit) is a flat list of repo rows that look the same, sorted by trending, and
labelled with metadata the uploaders filled in themselves.

The path a user takes through the Hub to a runnable file:

1. **Model → derivative.** The sidebar's model tree counts the derivatives
   (Qwen3-8B: 491 quantizations, 2,289 finetunes, 2,428 adapters), but
   clicking a count opens a generic list sorted by trending. Rank 2 among the
   quantizations has 83 downloads. The top 5 hold 86% of downloads; 344 of
   the 491 have fewer than 100.
2. **Rows show who uploaded, but not what the upload is.** `owner/repo`
   names the publisher, but nothing says whether the repo is the official
   release, a quantization, a re-upload of identical weights, or a modified
   finetune. Format and bit-width aren't shown either. The size column counts
   stored tensor elements, so packed quants of an 8B model show as "5B"
   (NVFP4) or "2B" (GPTQ).
3. **Derivative → file.** A good GGUF repo still offers 25 files. The Hub's
   hardware panel groups them by bit-width with sizes, which is the right
   shape. Without logging in, though, nothing says what fits your machine,
   what quality each level gives up, or where to start.
4. **Filters trust the uploaders' tags.** "Base only"
   (`base_model_relation=base`) follows the schema: it drops `Qwen/Qwen3-8B`
   and `Llama-3.1-8B-Instruct`, which are tagged as finetunes of their base
   models. It keeps untagged third-party copies. Users read the label as
   "originals," so the filter quietly returns the wrong set. Of the 200 newest
   models, about 60% have no task tag and about 66% no license.

Where the reviewers disagreed (these are still open):
- **Which step hurts most.** Fable ranks the misleading filters highest,
  Astra the choice of file, and Grok the trending sort inside derivative
  lists. Grok also thinks the file step is the least broken, because the
  Hub's own run snippets already pick `UD-Q4_K_XL`.
- **No entry point by intent** (Fable only). Nothing takes a user from
  "16 GB laptop, want a chat model" to a shortlist; the landing page is
  global trending.
- **Official collections are underused** (Grok only). The Qwen3 collection
  already lists every official size and format (BF16, AWQ, GGUF, FP8,
  MLX), but it appears only as a sidebar card, never as a search result.

Things the Hub does well that v2 must not lose: exact `owner/repo` identity,
the filter vocabulary (Apps, parameter range), the model-tree outline and its
linkable `base_model:{relation}:{id}` filters, the GGUF bit-width matrix,
generated run commands, the license/gated state, papers, and the
downloads sparkline.

### What a wrapper can and cannot fix

**Can:**
- Show the path from model to derivative to file, with relations from the
  tags.
- Mark each row's role and format (from tags, filenames and the `gguf`
  block).
- Rank derivatives by downloads and collapse the long tail, while keeping
  every repo reachable.
- Detect exact re-uploads by matching file `oid`s.
- Rank official collections above search results.
- Give a memory-fit estimate without login, from sizes in the tree API, the
  RAM/VRAM a user enters, and a KV-cache estimate (v1 `memory.ts`).
- Show "unknown" instead of guessing.

**Cannot:**
- Group repos that have no lineage tags, except by name heuristics that will
  sometimes be wrong.
- Catch wrong tags.
- Judge quantization quality without external benchmarks.
- Blindly replace the parameter count: some repos really are smaller, such as
  a sliced 2B block of an 8B model.
- Download gated weights (e.g. Llama).

### What this evidence doesn't cover
- Real users. This is UI behaviour, not measured failure rates. Next step:
  give one hardware-limited task ("pick a file for a 16 GB laptop") to a
  novice and to an expert, and record time and wrong picks.
- **Ollama's library and LM Studio's catalog may be the real competitor** for
  this user, not the Hub itself. Compare against them before building.
- The logged-in hardware profile, mobile layouts, non-LLM tasks, and gated
  downloads.

### Hub API capabilities v2 builds on

- Lineage: `expand[]=baseModels`, `expand[]=childrenModelCount`,
  `filter=base_model:{relation}:{id}`
- Size: `num_parameters=min:6B,max:9B`, `safetensors.total`, `expand[]=gguf`
- Runtime: `apps=llama.cpp`, `library=mlx`
- Activity: `trendingScore`, `downloads`, `createdAt`

## Core screens

1. **Explore** (`/`). A dense, filterable list: task, size band, runtime,
   license, format, and "originals only." Filter state lives in the URL, so a
   view can be shared as a link. Rows group derivatives under their base
   model, e.g. `Qwen3-8B · 491 quantized · 2287 finetunes · 2426 adapters`.
2. **Model** (`/m/{org}/{name}`). A key-facts header, then the **model tree**:
   lineage upward and children by relation (quantized / finetune / adapter /
   merge), each sortable by downloads or recency. Then a file/format summary,
   the memory-fit estimate, run commands, and the rendered card.
3. **Org** (`/o/{org}`). An org's releases shown as a timeline, not a flat repo
   list.
4. **Compare** (`/compare?ids=a,b,c`). Two or three repos side by side, using
   the same fact rows.

## Architecture

- Next.js App Router. Server components fetch the Hub API with
  `fetch(..., { next: { revalidate } })` caching. There is no database.
- An optional `HF_TOKEN` server env raises rate limits. It is never sent to the
  client.
- **Keep from v1** (pure, already Convex-free): `src/lib/atlas/memory.ts`,
  `fit.ts`, `naming.ts`, `runCommands.ts`, `taxonomy.ts`, `brands.ts`,
  `artifactBuilds.ts`, brand logos, and the design system (`DESIGN.md`,
  tokens in `globals.css`).
- **Leave behind on this branch**: Convex (catalog sync, webhooks,
  reconciliation, auth), `(workspace)` routes, `local-computer/`, deployment
  comparison, benchmark import, docs articles. These stay on `main`, so
  nothing is lost.

## Milestones

1. **Strip down.** Remove the Convex and workspace surfaces, add a typed Hub
   client (`src/lib/hub/`) with fixtures for tests, and make CI green.
2. **Model page + tree.** This is the core of v2 and the best demo.
3. **Explore.** URL-driven filters, base-model grouping, "originals only."
4. **Org timeline + compare.**

## Open decisions

- **Scope:** models only (recommended for now), or datasets/Spaces too?
- **Task focus:** every pipeline tag, or text/vision LLMs first, where the
  memory-fit and runtime filters matter most?
- **Deployment:** a separate Vercel project/preview for `v2`, or preview
  deployments of the branch only?
