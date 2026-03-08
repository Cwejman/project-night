---
id: 06-agent-1
title: Knowledge Parse — Agent 1
tags: [parse, synthesis, experiment]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — High-Level Summary

This is a local-first, model-agnostic, persistent memory system being built in two phases: a markdown-file phase to establish structure and seed content, followed by a Qdrant-backed semantic retrieval layer exposed via MCP so Claude can query it as native tooling in any session. Its defining design value is session irrelevance — the session is a compute surface, not a memory surface — and its core architectural commitments are content-agnosticism, semantic retrieval by meaning rather than keyword, and zero cloud dependency.

## Layer 2 — Deep Layer

### What is explicitly stated

- The system is explicitly not a documentation tool; it is a queryable memory layer.
- Phase 1 is the current state: flat markdown files, manually queried or read directly by Claude.
- Phase 2 targets Qdrant in local mode, an MCP server in TypeScript, and Anthropic embeddings (voyage-3 is a candidate, not yet confirmed).
- The metadata schema is already fixed and in use, designed for filtering, deduplication, and future migration.
- Phase 1 entries are explicitly intended as seed data for Phase 2 ingestion.
- Three rules govern Phase 1: one concept per file, always update the index after changes, MEMORY.md is pointer-only.
- Chunking strategy is unresolved (TBD at build time).
- An API-token-free embedding path with Anthropic is desired but not yet confirmed.

### What is implied

- The index.md is being maintained manually — a brittle dependency in Phase 1 that Phase 2 presumably resolves.
- The system is being built in a personal/single-developer context, not a team environment, at this stage.
- MEMORY.md exists as a pointer to the knowledge directory — the current workaround for session statefulness.
- "Model-agnostic" in the vision suggests the intent is for storage format and MCP interface to generalize beyond Claude.
- The TypeScript choice implies the surrounding project is also TypeScript/JavaScript.

### Connections across entries

- Session irrelevance is the philosophical backbone that motivates the entire architecture — each technical decision is downstream of this value.
- The markdown phase rules are designed to make Phase 2 ingestion clean — structure imposed now shapes vector quality later.
- The metadata schema in tech-stack.md maps exactly to the frontmatter format in markdown-phase.md, confirming these were written with migration in mind.
- The "consumer-agnostic" vision is in mild tension with the personal-context signals in tech-stack.md (local mode, single API token).

### What appears missing or unresolved

- Chunking strategy is the largest open technical question with no stated decision criteria.
- The API-token-free Anthropic embedding path is flagged but unresolved — if unavailable, local-only operation still requires an active API key.
- No entry covers MCP tool signatures, what search returns, or how confidence/result limits are handled.
- No entry covers update and deduplication logic for Phase 2 re-ingestion.
- The namespace concept is in the schema but its retrieval semantics are undefined (isolated vs. cross-namespace search).
- Security and access control are absent — reasonable for local-first personal use, a gap if the consumer-agnostic aspiration is pursued.
- No strategy stated for retiring, merging, or versioning entries as the knowledge base grows.

### Structural observations about the knowledge itself

- All five existing entries were created on 2026-03-08, indicating the knowledge base was bootstrapped in a single session.
- IDs are sequential integers (01–05); this entry uses compound id (06-agent-1), marking the first non-human-authored entry — a potential provenance convention.
- The knowledge base is internally consistent: no contradictions found across entries.
- The system is eating its own cooking: this knowledge base is itself a Phase 1 demonstration, and writing this entry is an in-context experiment in agent-authored knowledge.
- The two-layer entry format (Layer 1 for semantic embedding, Layer 2 for depth) is not yet a stated convention — introduced here, and could be formalized as a new entry format rule.
