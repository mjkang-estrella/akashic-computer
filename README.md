# Akashic Computer

Akashic Computer is an open-weight model atlas for navigating model families,
parameter sizes, variants, quantized artifacts, benchmarks, runtime support, and
hardware fit.

The product is designed around the path a user actually takes:

```text
Family -> Release -> Size -> Variant -> Artifact -> Runtime/Benchmark/Fit
```

Example:

```text
Qwen -> Qwen 3.6 -> 27B -> Instruct -> NVFP4 -> 18-24 GB VRAM
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Convex backend/database
- Hugeicons

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Convex

Convex is the only runtime source of truth for the public catalog.

To create and sync a Convex dev deployment:

```bash
npx convex dev
```

The first run will open the Convex login/project setup flow.

Configure monitored sources and run the first audit after setting an operator
secret:

```bash
npx convex env set CATALOG_ADMIN_SECRET '<random-secret>'
npx convex run admin:syncSourceConfig '{"secret":"<random-secret>"}'
npx convex run admin:runAudit '{"secret":"<random-secret>"}'
```

See `docs/catalog-sync.md` for production deployment, Hugging Face webhooks,
daily reconciliation, validation rules, and operational checks.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Personal local workspace

The [Akashic Computer companion](local-computer/README.md) connects your LAN fleet to the signed-in website and desktop MCP App. Public model discovery remains at the homepage. Account conversations and job progress sync through Convex; inference runs on your hardware. Existing device-only sessions stay local.

See [connected workspace setup](docs/connected-workspace.md) for GitHub authentication, enrollment, deployment flags, and rollback.

## Planning Docs

The optional [deployment comparison workflow](docs/deployment-comparison.md) adds exact quantized files, component memory estimates, GitHub account profiles, private KLD/Top-1 and performance imports, saved decisions and export-only pinned recipes. Enable it with `NEXT_PUBLIC_DEPLOYMENT_COMPARISON=true` after preparing the backend. Public signup is separately controlled by the server's `WORKSPACE_ACCESS_MODE=github`. Automated benchmarking is deferred.

- `PRODUCT.md`
- `DESIGN.md`
- `docs/product-brief.md`
- `docs/design-agent-prompt.md`
