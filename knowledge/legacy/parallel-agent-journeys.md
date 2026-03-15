---
id: 42
title: Parallel Agent Deep Journeys — Power Pattern
tags: [agents, parallel, architecture, embedding, cognition]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Running multiple agents simultaneously against the same knowledge base is a high-value pattern. Each agent loads Layer 1 summaries (~4k tokens, ~2% of context) and does independent deep analysis. Because the top layer is small, there is no context bottleneck — parallel journeys are essentially free. The parse experiment (4 agents, founding session) demonstrated this: each surfaced unique insights from the same corpus. This pattern should be a regular practice.

## Layer 2 — Full Detail

### Why it works without bottleneck

The Layer 1 bootstrap is ~4k tokens (~2% of 200k context). Each parallel agent loads this independently. With 200k context per agent, 10 parallel agents consume 40k tokens of bootstrapped knowledge collectively — negligible. The per-agent context is independent; there is no shared pool.

As long as Layer 1 stays fit in context (enforced by embedding optimisation), parallel deep journeys have no structural bottleneck.

### The parse experiment as the prototype

In the founding session, 4 agents (agents 0–3) each read the same 5-entry knowledge base and produced independent syntheses. Key finding: **different agents surfaced different gaps**. Agent 1 found the provenance convention. Agent 3 found the missing entry linking mechanism and agent write protocol. Agent 2 found the index coordination problem. Agent 0 found the migration consequence.

No single agent found everything. The union of parallel agents was more complete than any individual parse.

### Pattern: parallel judgment

Give N agents the same knowledge base and the same question. Compare their outputs. Convergence = high confidence. Divergence = unresolved ambiguity worth exploring. This is peer review at agent speed.

### Application to purification

Run 3 parallel semantic purification agents on the same session transcript. Each produces a gap list. Union the gaps. Divergence on which gaps matter = judgment call for the primary agent. This makes purification more robust than a single-agent check.

### Scaling consideration

As Layer 1 grows, the per-agent bootstrap cost grows. At ~20k tokens (10% of context), parallel agents start to feel it. This is the signal to move to namespace-segmented bootstrapping or Phase 2 MCP on-demand retrieval.

### Exploratory agents vs. persistent divergence (exploratory thought)

Spawning parallel agents with different focus areas to see what they surface — this is the parse experiment pattern, and it's valuable. But there's a distinction worth noting: these are ephemeral explorations, not persistent worldviews. The knowledge system is one aligned body ("one law") even as its depth grows multidimensional. Parallel agents explore from different angles, but their findings feed back into a unified knowledge base. The system doesn't maintain persistent agents with isolated, potentially conflicting perspectives — that would grow conflict rather than coherence.
