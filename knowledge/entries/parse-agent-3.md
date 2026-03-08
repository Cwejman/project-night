---
id: 06-agent-3
title: Knowledge Parse — Agent 3
tags: [parse, synthesis, experiment]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — High-Level Summary

This is a local-first, model-agnostic, semantically queryable memory system being built for Claude, designed to decouple knowledge from session context so that every session starts with full capability rather than blank state. It proceeds in two phases: a markdown-file foundation (Phase 1, current) that establishes structure and populates seed knowledge, followed by a Qdrant vector database with an MCP server interface (Phase 2) that makes knowledge retrievable by meaning rather than keyword. Its core design values are content-agnosticism, consumer-agnosticism, local persistence, semantic retrieval, and session irrelevance — treating the session as a compute surface and the knowledge system as the durable memory layer.

---

## Layer 2 — Deep Layer

### What is explicitly stated

- The system is explicitly not a documentation tool; it is a persistent, queryable memory layer (vision.md).
- Phase 1 is the current state: markdown files stored under `knowledge/entries/`, with a master `index.md` tracking all entries. Query in this phase is manual — grep or direct Claude file reading.
- Phase 2 will introduce Qdrant (local mode, no infrastructure dependency), an MCP server written in TypeScript exposing store/search/update/delete tools, and Anthropic embeddings (with voyage-3 as a candidate model to evaluate).
- The metadata schema is standardized: `id`, `title`, `tags`, `namespace`, `created`, `updated`. This schema is load-bearing: it supports filtering, deduplication, and future migration.
- Entry rules are strict: one concept per file, index must be consulted before creating entries (to prevent duplicates), MEMORY.md is pointer-only and never holds knowledge content.
- The "session irrelevance" principle is explicitly called a core design value, not just a side effect.

### What is implied

- The markdown phase is deliberately minimal and temporary — it exists to build a corpus of seed data before the vector infrastructure is ready, not because markdown is the long-term storage medium.
- The system anticipates Claude as the primary agent interacting with it, but "consumer-agnostic" implies it should not be tightly coupled to any particular Claude session, project, or user workflow.
- The decision to use TypeScript for the MCP server is driven by ecosystem consistency (MCP SDK availability), not a strong technical preference — this suggests the architecture boundary between language and tooling is pragmatic rather than principled.
- The Anthropic embedding choice is partially opportunistic ("no extra API token required initially"), which implies the embedding layer is expected to evolve or be swapped.
- The chunking strategy being "TBD" is architecturally significant: it is the only major technical decision left fully open, and it will directly affect retrieval quality once Phase 2 begins.
- The two-phase structure implies the Phase 1 knowledge corpus will be ingested wholesale into Qdrant as seed data — meaning the quality and structure of Phase 1 entries directly determines Phase 2 retrieval fidelity.

### Cross-entry connections

- `session-irrelevance.md` and `vision.md` are philosophically coupled: session irrelevance is the experiential outcome of the system properties listed in the vision (local-first, semantic, Claude-native). They are the same idea expressed at different levels of abstraction.
- `tech-stack.md` and `roadmap.md` are implementation-level complements: the roadmap describes what happens when, and the tech stack describes what is used. They converge on Phase 2 but do not fully resolve each other (chunking and embedding path are deferred in both).
- `markdown-phase.md` functions as the operational contract for Phase 1 — it defines the rules that make Phase 1 data clean enough to migrate. This entry has a hidden dependency on tech-stack.md: if the metadata schema changes before Phase 2, Phase 1 entries may need re-tagging.
- `roadmap.md` references voyage-3 as an embedding candidate; `tech-stack.md` notes it for future exploration. This cross-reference is the only place where a specific model name appears, suggesting it is a tentative preference rather than a committed decision.

### Gaps and unresolved questions

- **Chunking strategy** is the most consequential unresolved technical decision. Whether entries are chunked at fixed token boundaries, sentence boundaries, or semantically will materially change retrieval behavior, especially for longer entries.
- **API-token-free embedding path**: the current plan assumes Anthropic embeddings, but the system is supposed to require no additional API token "initially" — the path beyond "initially" is not defined. This is a dependency risk if the system is meant to be fully local-first.
- **No search interface for Phase 1**: there is no structured query mechanism in Phase 1 beyond manual reading. Claude agents parsing the knowledge base (as this very entry demonstrates) are operating outside the system's intended retrieval model. Phase 1 "retrieval" relies entirely on Claude's file-reading capability rather than semantic proximity.
- **No versioning or conflict resolution strategy**: the rules specify updating `index.md` after changes and using the index to avoid duplicates, but there is no defined behavior for updating or deprecating existing entries, or handling divergence between the index and the entries directory.
- **No explicit access control or namespace isolation**: `namespace` is part of the metadata schema but there is no defined behavior for namespace-scoped queries or cross-namespace retrieval. The namespace field exists but its semantic role in Phase 2 retrieval is unspecified.
- **No entry linking mechanism**: entries are independent files with no explicit cross-reference or relationship syntax. Connections between ideas must be inferred semantically, not followed structurally.
- **No defined agent write protocol**: this entry and the parse-agent series implied by its naming suggest that agents are being used to write into the knowledge base. There are no rules governing agent-authored entries — authorship provenance, validation, or review are absent from the current design.

### Structural observations about the knowledge itself

- All five existing entries share the same creation and update date (2026-03-08), indicating the knowledge base was bootstrapped in a single session. The corpus reflects a single moment of design thinking, not accumulated knowledge over time.
- The entry density is high relative to corpus size: five entries cover vision, tech stack, file structure rules, roadmap, and one philosophical design value. The knowledge base is skeleton-complete but content-thin — it has coverage without depth.
- The naming of this entry as `parse-agent-3` implies at least two prior parse-agent entries exist or are expected. The index does not list them, which either means they predate this corpus, were not added to the index, or are planned but not yet written. This is a structural inconsistency worth resolving.
- The system is self-describing in an unusually tight loop: the knowledge base documents the rules for maintaining itself, stored inside the system it describes, queryable by the agent that writes into it. This recursive quality is intentional and is the mechanism by which the system bootstraps its own memory.
