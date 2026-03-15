---
id: 08
title: Multi-Layer Embedding Architecture
tags: [architecture, embedding, layers, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The knowledge system currently uses a two-layer embedding model (L1 summary + L2 full content), but this structure is a markdown-phase artifact now under reconsideration. The bite model — where the fundamental unit is a weighted chunk with proximity relationships, not a file with layers — may replace it. In that model there is no L1/L2, just chunks with weights; what we call an "entry" becomes a cluster of close-weighted chunks. Whether the markdown PoC continues with two-layer files or evolves toward something closer to the bite model is an active exploration.

## Layer 2 — Full Detail

### The two-layer model

Every entry has two distinct semantic zones:

**Top layer** (Layer 1 / Summary):
- One tight paragraph
- Optimized for embedding and semantic retrieval
- Captures the essence — what this entry is about
- Must remain concise regardless of how large the deep layer is

**Deep layer** (Layer 2 / Full content):
- Unconstrained size
- Holds complete information: observations, scripts, tool calls, raw data, detailed specs
- Does not affect top-layer embedding quality
- Retrieved only when the top layer match is confirmed relevant

### Why this matters

Large artifacts (e.g. complete scripts, tool call definitions) can be stored without polluting the semantic index. The top layer acts as a precision filter; the deep layer delivers full fidelity once a match is confirmed.

This means: storing a 500-line script does not harm search quality. The script lives in Layer 2; the summary of what it does lives in Layer 1.

### Application to tool calls

Script-based tool calls are first-class knowledge artifacts and should be stored in this system using the same entry format:
- Layer 1: what the tool call does, when to use it, what it returns
- Layer 2: the full script/implementation

See: `tool-call-storage.md`

### L2 scaling concern

Storing full session dialogs makes L2 a strange metric quickly — session-prompts entries already dominate L2 token counts. As the system grows, L2 as a flat text block becomes less useful, not more. The right direction is L2 tagged and weighted in vector relationship to L1 — not a flat append but a structured semantic layer where depth is addressable by meaning. The .md format approximates this but cannot implement it properly. This is one of the reasons the .md PoC may be scrapped in favour of the vector system.

### Vector as directory

Filesystem folders give humans organizational importance — they impose a hierarchy the author chose. Vectors are the ultimate directories: you look based on what you want to see, not where something was filed. The folder hierarchy is a human navigation aid; the vector neighbourhood is the semantic truth. The .md system uses folders as a proxy; Stage 3 replaces that with actual semantic proximity.

### The bite model — what the ideal information unit might be

In the most liberal vector-based conception, the fundamental unit isn't a file with layers — it's a weighted bite-sized chunk. There is no L1 and L2. There are just chunks, each with a weight and proximity relationships to other chunks. What we currently call an "entry" may, in the ideal system, be a cluster of close-weighted chunks rather than a single bounded file. The breath out (exhale/write) would produce a cluster of related bites, not a single document.

This dissolves the coupling problem entirely: there is no file boundary, no single summary to maintain, no one-dimensional depth. Retrieval assembles a view from whatever chunks are closest to the query vector, regardless of their origin.

L1/L2 as a format is therefore a markdown-phase artifact — a human-readable approximation of what is naturally expressed as weighted proximity. Whether the markdown PoC should attempt to approximate this (e.g. through sub-sections, weighted tags, cross-entry links) or simply accept its single-file limitation while proving the breath discipline — that is still open.
