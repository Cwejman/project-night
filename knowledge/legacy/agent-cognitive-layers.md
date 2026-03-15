---
id: 38
title: Agent Cognitive Layers — Specialisation Through Selective Knowledge Loading
tags: [architecture, agents, cognition, namespaces, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The knowledge system's structure (entries with namespaces, tags, and types) enables different agents to be started with a specific cognitive slice — a point of view related to their purpose. An agent initialised with only `tool-call` entries sees a different world than one initialised with `vision` and `design` entries. This is agent specialisation through selective knowledge loading, made possible by the FS/vector structure.

## Layer 2 — Full Detail

### The insight

The filesystem structure of the knowledge base — entries organised by namespace, tags, and type — is not just an organisational convenience. It is a cognitive architecture. Different subsets of entries define different "points of view" for an agent.

### Examples of cognitive slices

| Agent purpose | Load entries tagged | Resulting point of view |
|---|---|---|
| Implementation agent | `tool-call`, `mcp` | Knows what tools exist and how to use them |
| Architecture agent | `vision`, `design`, `architecture` | Knows the system's goals and constraints |
| Verification agent | `verification`, `lossless`, `purification` | Knows the integrity rules |
| Embedding agent | `embedding`, `layers`, `type-system` | Knows how knowledge is structured |

### How to implement (Phase 1)

Bootstrap script accepts a tag filter: `node .claude/bootstrap.js --tags tool-call,mcp` injects only entries with those tags. The agent starts with a purpose-specific context rather than the full knowledge base.

### How to implement (Phase 2)

MCP search call at agent start: `search(query="how do I...", namespace="tool-calls", k=5)`. The agent's first tool call defines its cognitive starting point. No bootstrap file needed.

### Relationship to namespace design

This is why namespace and tag discipline matters. Namespaces are not just labels — they are the segmentation boundaries for cognitive loading. An entry in the wrong namespace or with wrong tags is loaded into the wrong agent's context, or missed entirely.

### The deeper implication

The knowledge system is not just a store — it is a configurable cognitive environment. The same facts, selectively presented, produce different agent behaviours. This is agent specialisation without hard-coding: change the loaded entries, change the agent's effective expertise.

### Toward a dynamic cognitive layer (exploratory)

The above frames cognitive loading as something set at startup. A further thought: the agent's cognitive focus may not be static — it could shift throughout a session as the work moves to different areas or as context compacts. Compaction, in this framing, is a form of cognitive weight-shift: things that were in focus become background. Whether this happens transparently or opaquely is an open question — one could imagine the agent's current cognitive state (what's loaded, what's been down-weighted) being observable, not just context health metrics.

A related thought: some knowledge might carry a weight class that marks it as always-included regardless of focus — culture and core identity being the clearest candidates. Not "bootstrap always loads this" as a technical rule, but the knowledge itself having metadata that says "I am always relevant." Whether this is achievable in markdown or requires the vector system is not yet clear.
