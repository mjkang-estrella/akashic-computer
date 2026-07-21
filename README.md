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
- Lucide icons

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Convex

Convex is the runtime source of truth for the public catalog. The static
`src/lib/atlas/catalog.ts` file is retained as the migration fixture and
rollback snapshot.

To create and sync a Convex dev deployment:

```bash
npx convex dev
```

The first run will open the Convex login/project setup flow.

Seed the current snapshot after setting an operator secret:

```bash
npx convex env set CATALOG_ADMIN_SECRET '<random-secret>'
npx convex run seed:seedCurrentCatalog '{"secret":"<random-secret>"}'
```

See `docs/catalog-sync.md` for production deployment, Hugging Face webhooks,
daily reconciliation, validation rules, and operational checks.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Planning Docs

- `PRODUCT.md`
- `DESIGN.md`
- `docs/product-brief.md`
- `docs/design-agent-prompt.md`
