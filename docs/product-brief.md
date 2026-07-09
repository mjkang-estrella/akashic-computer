# Akashic Computer Product Brief

Akashic Computer is a discovery and navigation surface for open-weight AI
models. It helps users move from a model family to the exact artifact they
should run, compare, or download.

## Core User Job

When a user hears about a model family like Qwen, DeepSeek, Llama, Gemma, or
Mistral, they should be able to answer:

- Which versions and parameter sizes exist?
- Which artifacts are official, vendor-provided, or community quantizations?
- Which runtime can run each artifact?
- What hardware is likely enough?
- What benchmarks changed after quantization or conversion?
- Which Hugging Face repo should I actually use?

## MVP Scope

- Family pages for Qwen, DeepSeek, Llama, Gemma, and Mistral.
- Release, size, variant, and artifact hierarchy.
- Quantization-aware artifact comparison.
- Benchmark cards with source/provenance links.
- Hardware fit filters for Mac, CPU, 24GB, 48GB, 80GB, and DGX-class systems.
- Confidence indicators for inferred metadata.

## Non-Goals For The First Build

- A universal model leaderboard.
- Ranking every model without task context.
- Running all benchmarks internally.
- Hosting model weights.
- Hiding provenance or confidence when metadata is inferred.

## Data Principles

- Treat Hugging Face metadata as input, not truth.
- Preserve provenance for every benchmark and compatibility claim.
- Keep family/version/variant/artifact as separate concepts.
- Prefer explicit confidence states over silently normalizing uncertain fields.
