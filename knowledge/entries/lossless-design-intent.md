---
id: 13
title: Lossless Design Intent
tags: [design, vision, lossless, durability]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The system is designed to be lossless. Nothing said, decided, or discovered should be lost to session boundaries, compaction, or time. Every insight is immediately written to the knowledge system — not deferred. The bootstrapping hook and two-layer format together make this achievable.

## Layer 2 — Full Detail

### What lossless means here

Lossless does not mean storing everything verbatim. It means:
- No insight is held only in session context
- No decision exists only in chat history
- No convention is assumed to be "obvious" and skipped
- Gaps are identified and closed in the same session they are found

### The gap → write reflex

Any time something is discussed that is not yet in the knowledge system, it gets written immediately — before the session ends, before the next topic starts. This is the primary discipline of the lossless system.

### Two failure modes

1. **Session loss**: knowledge discussed but not written before session ends. Mitigated by: writing immediately, not deferring.
2. **Compaction loss**: knowledge written to session context but not to disk. Mitigated by: bootstrap hook firing on `compact`, re-injecting Layer 1 summaries.

### Relationship to session irrelevance

Session irrelevance is the goal. Lossless is the discipline that makes it achievable. Without the lossless reflex, session irrelevance degrades — the new session starts with the knowledge files, but the files are incomplete.

### Types as an example

The observation that type definitions don't need first-class `.md` files — because the tag + Layer 1 embedding is self-describing — was noted in conversation and immediately written as an entry. That is the lossless reflex in action.
