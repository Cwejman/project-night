---
id: 04
title: Roadmap — Phases
tags: [roadmap, phases, planning]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-13
---

## Layer 1 — Summary

Two phases with a gradient between them. Phase 1 (current) — markdown files, hooks-invoked .js muscles, Claude Code integration. Phase 2 (direction) — semantic retrieval, cross-project knowledge access, vector storage. The exact form of Phase 2 is not settled — it is an understood direction with explored requirements, not a fixed plan. Between Phase 1 and Phase 2 lies an evolution gradient: muscles strengthen, the operational portability gap is addressed, then storage upgrades. Each step earned by actual need. See `roadmap-phase2-plan` for detail and `operational-discoveries-2026-03-12` for current operational understanding.

## Layer 2 — Full Detail

## Phase 1 — Markdown (current)
Storage: markdown files under `knowledge/entries/`
Query: manual / grep / Claude reading files directly
Goal: establish structure and populate knowledge before vector infra exists

## Phase 2 — Direction (not fixed plan)
Storage: Qdrant local instance (explored, likely)
Interface: MCP server exposing tools (store, search, update, delete) — one option, not settled as sole access path
Embeddings: Anthropic (voyage-3 candidate — evaluate at build time)
Migration: Phase 1 entries are seed data for Phase 2 ingestion

## Evolution gradient (between Phase 1 and Phase 2)

The transition is not a single step. Understood needs, in rough priority:

**Concretised:**
- Muscles strengthen — every convention violation earns a new enforcement hook. .js + hooks is the current mechanism.
- The operational portability gap must be addressed before multi-project operation makes sense.

**Explored but not settled:**
- Cross-project knowledge access — MCP, filesystem teleportation (symlinks), hybrid. Mechanism open.
- Whether muscles should remain platform-bound (Claude hooks) long-term, given model-agnostic values.
- When and how to introduce semantic retrieval (vector DB).
- The direction toward atomic, versioned semantic mutations is sensed but the form is not settled.

## Open questions
- API-token-free embedding path with Anthropic
- Chunking strategy (fixed / sentence / semantic)
- Cross-project access mechanism
- Context pressure on routines (verify/purify can't just run at session end)
