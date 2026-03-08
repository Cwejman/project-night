---
id: 40
title: Tool Call — measure-bootstrap.js
tags: [tool-call, script, bootstrap, introspection, tokens]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Measures token footprint of both Layer 1 (loaded into context) and Layer 2 (deep storage only) across all entries. Approximates tokens as chars/4. Reports counts, percentages of 200k ctx, and top 10 largest L1 entries. Writes l1Tokens, l1Pct, l2Tokens, l2Pct (plus bootstrapTokens/bootstrapPct aliases) to status.json. TUI KNOWLEDGE box and statusline display both layers.

## Layer 2 — Implementation

File: `.claude/measure-bootstrap.js`

```
node .claude/measure-bootstrap.js
```

Output: total chars, approx tokens, % of 200k context, bar chart of top 10 largest Layer 1 entries by token cost. Threshold warnings at 5k and 10k tokens.

Baseline (2026-03-08, 48 entries): L1 ~4,691 tokens (2.35% ctx), L2 ~23,513 tokens (11.76% ctx). Total on disk ~28k tokens. L1 lean.

### Why this matters

The bootstrap injects all Layer 1 summaries into context at session start. This cost is invisible without measurement. As entries grow, this number grows. When it approaches 10-15% of the context window, namespace segmentation or on-demand retrieval (Phase 2 MCP) should replace full bootstrap.

### Statusline integration

Writes l1Tokens, l1Pct, l2Tokens, l2Pct to `status.json.knowledge` (bootstrapTokens/bootstrapPct kept as aliases). Statusline shows `~4.7k L1 (2.35%) ~23.5k L2 (11.76%)`. TUI KNOWLEDGE box shows both rows. Run after any significant batch of new entries.

### Parse-agent entries are the largest

The parse-agent entries (1–3, 0) have the largest Layer 1 summaries (~140-191 tokens each). These are the natural candidates for truncation or namespace separation if optimisation is needed.
