---
id: 11
title: Deliberate Phase Buildup Before Vector DB Switch
tags: [strategy, phases, design, planning]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

We are deliberately accumulating requirements understanding before committing to a build format. The original plan was to prove everything in markdown first, then swap to vector DB. That assumption is now under reconsideration: the bite model (weighted chunks, no L1/L2 — see `multi-layer-embedding`) may not be well-approximated by one-concept-per-file markdown. The markdown PoC may still happen, may change shape, or may be bypassed. What remains constant: requirements must be understood through use before the vector system is built.

## Layer 2 — Full Detail

### Rationale

Switching to Qdrant prematurely would mean building against an unproven requirement set. Instead, Phase 1 serves as the requirement validation environment: every convention, entry format, bootstrapping mechanic, and tool call pattern is proven in the markdown system first.

By the time Phase 2 begins, we know:
- Exactly what data goes in (entry format, two-layer structure, frontmatter schema)
- Exactly what queries need to be answered (semantic search, namespace filtering, tag lookup)
- Exactly what the MCP tool signatures must look like (informed by actual usage patterns)
- What chunking strategy to use (informed by real entry sizes and retrieval needs)

### Consequence

The vector DB switch is not a pivot — it is a swap of the storage layer with the interface and conventions already determined. This eliminates the most common failure mode in vector DB projects: designing the embedding schema and query interface in the abstract, then discovering it doesn't match actual usage.

### Current bottleneck accepted

The FS-based system has known limitations (no semantic search, manual index, no concurrent writes). These are accepted constraints for Phase 1. The system is not being optimized for the bottleneck — it is being operated through it deliberately.

### The PoC may be scrapped

The markdown phase is explicitly a PoC. Culture + claude plugin built in .md proves the approach, not the final system. Once the approach is proven, the .md layer may be replaced entirely by whatever the vector/weighted system becomes. The phase buildup is deliberate knowing this — requirements are proven here so the replacement is a swap, not a redesign. See `poc-cycle-hardwiring` for the full PoC framing.

### The markdown format itself is under reconsideration

The current one-concept-per-file, two-layer format was designed before exploring the bite model (see `multi-layer-embedding`). If the ideal system has no L1/L2 — just weighted chunks in proximity — it's an open question whether markdown approximates this well enough to be useful as a PoC medium, or whether a different structure is needed. The format may change before the culture + claude build begins. Or the PoC may not use markdown at all. This is not settled.
