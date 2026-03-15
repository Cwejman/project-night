---
id: deep-layers-parallel-agents
title: Deep Layers for Parallel Agent Runs
tags: [architecture, parallel-agents, layers, future, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

Parallel deep runs will require richer depth than the current L1/L2 two-layer model. Agents diving into specific clusters need enough layered detail to surface non-obvious insights. The one-dimensional layer model is a Phase 1 approximation — the real structure is multi-dimensional and deeper. Not to be solved now; acknowledged as a design requirement for when vector storage is built.

## Layer 2

### Why depth matters for parallel agents

When multiple agents dive into the same knowledge base simultaneously, their value comes from surfacing different perspectives on the same content. Shallow entries (two layers, one summary + one detail block) limit how deep any agent can go. Richer entries — with multiple layers of abstraction, cross-references, temporal context, confidence levels — give parallel agents more to work with and reduce the chance that all agents converge on the same surface reading.

### Current limitation

L1/L2 is a flat ordered pair. It has no concept of: sub-entries, nested context, temporal history of an entry, confidence gradients, or relational depth. For a knowledge base with 50 entries this is fine. At 500+ entries with parallel agents doing thematic analysis, the structure becomes a bottleneck.

### Design direction (deferred)

When vector storage is built, the layer model should be redesigned from first principles informed by actual usage. Possible directions:
- Entries with variable depth (n layers, not fixed 2)
- Relational structure (entries referencing entries as sub-context)
- Temporal layers (entry state at different points in time)
- Confidence metadata per layer (high-confidence summary vs speculative detail)

None of this is in scope until Phase 1 usage makes the right shape obvious.
