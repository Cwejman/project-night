---
id: 37
title: Embedding Optimisation — The Other Purification Direction
tags: [embedding, optimisation, purification, context, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

When the top layer of the knowledge system becomes too large to fit in context, embedding optimisation is triggered. This is the outward purification: not checking for loss, but restructuring knowledge so the top layer remains context-efficient. The two-layer model is what makes this safe — only Layer 1 summaries are optimised; Layer 2 content is never compressed or lost.

## Layer 2 — Full Detail

### The problem it solves

As the knowledge base grows, the sum of all Layer 1 summaries will eventually exceed the context window. The bootstrap script injects all Layer 1s — when that becomes too large, it breaks the session-irrelevance property (new sessions can't be fully bootstrapped).

### Optimisation strategies

| Strategy | What it does | Risk |
|---|---|---|
| Summary compression | Shorten Layer 1 summaries | May lose nuance |
| Deduplication | Merge entries with overlapping Layer 1s | May lose granularity |
| Namespace segmentation | Bootstrap only loads the relevant namespace | Requires namespace discipline |
| Tiered loading | Load only the N most recently updated Layer 1s | May miss older relevant entries |
| On-demand retrieval | Bootstrap loads nothing; MCP search replaces it | Requires Phase 2 |

### The clean solution: Phase 2 MCP

When the MCP server exists, bootstrap becomes a search call: instead of loading all Layer 1s, Claude queries for the top-K most relevant entries for the current task. Context window is no longer a constraint. This is the designed endpoint — optimisation is a Phase 1 bridge.

### Relationship to purification

Semantic purification asks: is knowledge missing?
Embedding optimisation asks: is the knowledge system still fit to be loaded?

They are complementary health checks: one checks completeness, the other checks deployability.
