---
id: 11
title: Deliberate Phase Buildup Before Vector DB Switch
tags: [strategy, phases, design, planning]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

We are deliberately accumulating implemented requirements in Phase 1 (markdown + Node scripts) before switching to the vector DB. The goal is to avoid being bottlenecked by the current FS-based system — by the time we migrate, the system's behavior, rules, and tooling are already proven and the vector DB is purely a storage upgrade.

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
