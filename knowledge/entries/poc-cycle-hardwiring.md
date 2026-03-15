---
id: poc-cycle-hardwiring
title: PoC — Cycle Hardwiring and the .night Commitment
tags: [poc, vision, strategy, cycle, design]
namespace: knowledge-system
created: 2026-03-13
updated: 2026-03-13
---

## Layer 1

The core commitment: every cycle strictly writes to .night. Full dialog, tool calls, everything — embedded at its reasonable place. Not to claude memory, not staying in context only, to .night. The system stays true — aligned, non-corrupt, unable to conflict with itself. This commitment is format-independent. The original plan was a culture + claude plugin build in markdown, but before starting that build, deeper exploration of what the knowledge system actually is has begun (see `multi-layer-embedding` — bite model, `agent-cognitive-layers` — dynamic focus, `intelligent-garbage-collection` — weighting). The current markdown structure (L1/L2, one-concept-per-file) may not be the right medium. The PoC format is not settled — understanding the system comes before building it.

## Layer 2

> **Context (2026-03-15):** The content below was written when the PoC was assumed to be a markdown build. An exploration session has since begun questioning whether markdown (L1/L2, one-concept-per-file) is the right medium at all. The cycle hardwiring commitment remains; the format does not. See `multi-layer-embedding` (bite model), `deliberate-phase-buildup` (format reconsideration). Read the below as historical thinking, not current plan.

### The PoC framing

Culture + claude plugin is a PoC built in the markdown phase. Its value is proving the approach — can every cycle be hardwired to .night? — not delivering the final architecture. The .md system has a ceiling: it is human-readable now but won't scale, lacks weights, and the crude L1/L2 layer limits what vector relationships can express. When L2 needs to be tagged and weighted in semantic relationship to L1, the filesystem may not support it. The PoC is built knowing it may be scrapped in favour of whatever the vector/embedded system becomes.

### What the PoC must prove

Every cycle strictly commits to .night:
- Full dialog, tool calls, system events — embedded at their semantically reasonable place
- Nothing knowledge-worthy stays in context only
- Not written to claude memory, not deferred — to .night
- The .night system stays aligned: it can't conflict with itself, can't become corrupt

This is the hardwiring. Claude is agentic chat in the filesystem. The PoC tests whether an agent can remain bound to .night across a full session cycle without breaking the contract.

### Deviation model

Opting out is allowed but modeled explicitly. When working in a thread that shouldn't touch .night (a clean coding task, a non-touching exploration), you create a new dir and connect it to what you were just in. You're free, unencumbered, not polluting .night with noise. The new dir becomes its own peer — connected but separate. Bloat in this model means bad .night structure (entries that don't belong, noise, incoherence) — not context size.

### Vector as directory

Filesystem folders give humans organizational importance. Vectors are the ultimate directories: you look based on what you want to see, not where something was filed. The folder hierarchy is a human convention; the vector neighbourhood is the semantic truth. The .md system uses folders as a proxy for organization. Phase 2 replaces that with actual semantic proximity.

### L2 scaling concern

Storing full dialogs makes L2 a strange metric quickly. Session-prompts entries already dominate L2 token counts. As L2 grows it becomes less human-readable, not more. The right direction is L2 tagged and weighted in vector relationship to L1 — not a flat text block but a structured semantic layer. The .md format approximates this but can't implement it properly.

### Lore migration

Once the PoC is proven and a clean .night system exists, the existing `knowledge/entries/` content is migrated as lore — the evolutionary depth of how the system became what it is. That migration is not the PoC's goal; it is what comes after. The PoC builds from scratch, runs clean, proves the cycle hardwiring commitment, then absorbs the history.
