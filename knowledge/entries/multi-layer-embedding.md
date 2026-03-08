---
id: 08
title: Multi-Layer Embedding Architecture
tags: [architecture, embedding, layers, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The knowledge system uses a two-layer embedding model: a concise top layer optimized for semantic search, and a deep layer that holds full content including large artifacts. Large content (scripts, tool calls, raw data) lives in the deep layer and does not degrade top-layer retrieval quality.

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
