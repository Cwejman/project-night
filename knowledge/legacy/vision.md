---
id: 01
title: Knowledge System Vision
tags: [vision, goals, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-13
---

## Layer 1 — Summary

A first-class, model-agnostic, local-first knowledge system. Content-agnostic and consumer-agnostic. Accessible via MCP and/or direct file access — MCP is an integration boundary, not the sole gateway. Retrieval by meaning, not keyword. Not a documentation tool — a persistent, queryable memory layer that IS the agent's identity.

## Layer 2 — Full Detail

Build a first-class, model-agnostic knowledge system that IS the agent's identity — not an augmentation of any particular LLM.

Core properties:
- Content-agnostic: any kind of knowledge can be stored
- Consumer-agnostic: not designed for a specific user or team
- Model-agnostic: the system instantiates an agent on top of any LLM
- Local-first: persists across restarts, no cloud dependency required
- Semantic: retrieval by meaning, not keyword
- Accessible via MCP (integration boundary) and/or direct file access — not locked to one interface
- Cycle-hardwired: every cycle strictly writes to .night — full dialog, tool calls, decisions — embedded at their semantically reasonable place. Nothing knowledge-worthy stays in context only.

The system is not a documentation tool. It is a persistent, queryable memory layer — the agent's constitutive identity, not a tool the agent uses. The cycle hardwiring is the behavioral commitment that makes identity persistent rather than aspirational.
