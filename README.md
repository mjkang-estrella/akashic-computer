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

Convex is installed and the initial schema lives in `convex/schema.ts`.

To create and sync a Convex dev deployment:

```bash
npx convex dev
```

The first run will open the Convex login/project setup flow.

## Planning Docs

- `PRODUCT.md`
- `DESIGN.md`
- `docs/product-brief.md`
- `docs/design-agent-prompt.md`
