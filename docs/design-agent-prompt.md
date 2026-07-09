# Design Agent Prompt

Design a production-quality web app for Akashic Computer at akashic.computer.

Akashic Computer is an open-weight AI model atlas. It helps users navigate from
model families to versions, parameter sizes, variants, quantized artifacts,
benchmarks, runtime support, and hardware fit. The product should feel like a
serious technical browser for developers and AI newcomers, not like a generic
SaaS landing page.

## Primary Screen

Design the main application screen, not a marketing homepage.

The first viewport should make these objects obvious:

- Model families: Qwen, DeepSeek, Llama, Gemma, Mistral.
- Selected family: Qwen.
- Selected release: Qwen 3.6.
- Selected size: 27B.
- Artifact rows: BF16, NVFP4, AWQ, GPTQ, GGUF, MLX if relevant.
- Filters: task, license, hardware, runtime, quantization, benchmark source.
- Comparison panel for benchmark deltas and hardware fit.

Use Qwen 3.6 27B NVFP4 as the example focused path:

`Qwen -> Qwen 3.6 -> 27B -> Instruct -> NVFP4 -> benchmarks/runtime/hardware`

## UX Requirements

- Make lineage visible: family, release, size, variant, artifact.
- Make it easy for beginners to understand why there are many repos for one
  model.
- Distinguish official, vendor, and community artifacts.
- Show confidence/provenance for inferred metadata.
- Avoid a leaderboard-first layout. Ranking is secondary to navigation.
- Support side-by-side artifact comparison.
- Support a "can I run this?" hardware fit answer.
- Keep density high enough for technical users without overwhelming newcomers.

## Visual Direction

- Calm, precise, technical, and trustworthy.
- Use a restrained palette with warm paper, black ink, green verification, blue
  metadata, and amber caution.
- Avoid purple/blue gradient SaaS styling.
- Avoid giant hero sections, decorative blobs, nested cards, and marketing copy.
- Prefer tables, rails, segmented controls, chips, drawers, and compact panels.
- Use icons only where they improve scanning.

## Deliverables

- Desktop primary app screen.
- Mobile responsive version of the same workflow.
- Empty/loading/error states for model search.
- Artifact comparison drawer.
- Component notes for family rail, release selector, artifact table, benchmark
  cells, runtime badges, hardware fit badges, and provenance indicators.

## Copy Tone

Plain, useful, and specific. Example labels:

- "Official checkpoint"
- "Vendor quant"
- "Community GGUF"
- "Inferred from repo name"
- "Runs on 48GB"
- "Benchmark source"
- "Quality delta"
