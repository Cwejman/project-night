---
id: 35
title: Purification — Archival vs Semantic Completeness
tags: [purification, lossless, semantic, verification, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

There are two levels of purification. Archival: were the raw prompts stored? Semantic: was the knowledge contained in those prompts extracted into the system? Storing prompts is not lossless — it is a record of input. Lossless requires that every decision, instruction, and insight from the session exists as a knowledge entry, not just as a raw message log. The real purification check is semantic.

## Layer 2 — Full Detail

### The distinction

| Level | Question | What purify.js does today |
|---|---|---|
| Archival | Were the prompts stored? | ✓ weak check |
| Semantic | Was the knowledge in those prompts extracted? | ✗ not yet |

Storing `session-prompts-2026-03-08.md` with raw prompt text is evidence the session happened. It is NOT evidence that the knowledge system reflects the session's decisions.

### Why this matters

A prompt like "the Node.js rule should be hardcoded" has semantic content: a permanent rule. If that rule is captured in `tool-call-storage.md`, the knowledge is not lost — even if the raw prompt is never stored. Conversely, if the raw prompt is stored but no rule entry exists, knowledge IS lost despite archival completeness.

The lossless guarantee is about the knowledge system being a complete model of all decisions made — not a complete log of all messages exchanged.

### What semantic purification looks like

1. Read the session transcript
2. Identify: what decisions, rules, architectural choices, and insights were stated?
3. For each one, check: does a knowledge entry exist that captures it?
4. Report gaps — entries that should exist but don't

This cannot be done purely mechanically. It requires semantic understanding — Claude reading the transcript and cross-referencing the knowledge index. This is the same activity as the parse-agent experiment, but applied to the session-knowledge delta specifically.

### The bootstrap ↔ purify duality (corrected)

| Script | Direction | What it checks |
|---|---|---|
| bootstrap.js | Inward | Loads knowledge summaries into context |
| purify.js (archival) | Outward | Were prompts stored? |
| purify --semantic (future) | Outward | Is the knowledge system complete relative to the session? |

### Practical approach for Phase 1

Run a semantic purification manually: at the end of each session, Claude reads the transcript and the knowledge index and asks: "what was decided that isn't captured here?" This is the doctor's real diagnosis. The archival check is just the preliminary vitals.

### Implication

The session-prompts entries are a secondary archive — useful, but not the lossless guarantee. The lossless guarantee is that the knowledge entries are complete and accurate. The prompts are evidence; the entries are the truth.
