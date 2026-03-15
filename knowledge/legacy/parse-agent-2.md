---
id: 06-agent-2
title: Knowledge Parse — Agent 2
tags: [parse, synthesis, experiment]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — High-Level Summary

This is a local-first, Claude-native knowledge system designed to serve as a persistent external memory layer — content-agnostic and consumer-agnostic — that retrieves knowledge semantically via MCP tools rather than relying on session context. It is being built in two phases: a markdown-file phase (current) that establishes structure and populates seed knowledge, followed by a Qdrant-backed vector search phase with an MCP server interface. Its governing design value is session irrelevance: the session is a compute surface, not a memory surface, and knowledge must survive and remain fully accessible across any session boundary without degradation or re-explanation.

## Layer 2 — Deep Layer

### What Is Explicitly Stated

- The system targets five core properties: content-agnostic, consumer-agnostic, Claude-native (via MCP), local-first, and semantic retrieval.
- It is explicitly not a documentation tool — it is a queryable memory layer.
- Phase 1 (current) uses markdown files with a strict one-concept-per-file rule, a standardized frontmatter schema (id, title, tags, namespace, created, updated), and a master index that must be consulted before any new entry is written.
- Phase 2 will use Qdrant in local mode as the vector database, Anthropic embeddings (voyage-3 as a candidate model), a TypeScript MCP server exposing store/search/update/delete tools, and Phase 1 entries as seed/migration data.
- MEMORY.md is pointer-only and must never contain knowledge content.
- Three decisions remain open for Phase 2: API-token-free embedding path, chunking strategy (fixed/sentence/semantic), and the exact embedding model to evaluate at build time.

### What Is Implied

- The two-phase design is intentional bootstrapping: the markdown phase is not a permanent solution but a discipline-building and seed-collection exercise before the infrastructure exists to use it properly.
- The choice of Qdrant in local mode, Anthropic embeddings, and TypeScript all reflect a preference for minimal external dependencies and ecosystem consistency — the system should run entirely on the local machine without cloud accounts beyond what Claude already uses.
- The metadata schema (especially namespace and tags) is forward-looking: it anticipates filtering, deduplication, and migration operations in Phase 2, not just human readability in Phase 1.
- The session irrelevance principle implies that the system is also designed to be resilient to model changes — because knowledge is external and model-agnostic, switching or upgrading the underlying model does not lose memory.
- The "consumer-agnostic" property implies the system is intended to be shareable or reusable across different Claude contexts (different projects, different users) without modification.

### Connections Across Entries

- The session irrelevance entry (05) is the philosophical core that explains why every other architectural decision was made: local-first storage, semantic retrieval, MCP interface, and phase structure all exist in service of that principle.
- The roadmap (04) and tech-stack (02) entries are tightly coupled: Qdrant, voyage-3, and TypeScript in tech-stack map directly to Phase 2 in the roadmap, and the open questions are identical across both entries (chunking, API-token-free embeddings).
- The markdown-phase entry (03) operationalizes the roadmap's Phase 1: it provides the concrete rules (one concept per file, index discipline, MEMORY.md pointer-only) that make Phase 1 entries usable as clean seed data for Phase 2 ingestion.
- The vision entry (01) establishes the five properties, and every subsequent entry can be read as either implementing or preserving one or more of them — session irrelevance preserves "local-first" and "semantic"; the markdown phase preserves "content-agnostic"; the tech stack preserves "model-agnostic" (via Qdrant's independence from any embedding provider).

### Gaps and Unresolved Questions

- No retrieval design is specified for Phase 1: the roadmap describes it as "manual / grep / Claude reading files directly," which is a placeholder, not a design. There is no tooling described for Phase 1 search.
- The chunking strategy is acknowledged as TBD in two separate entries but never discussed further — no options are evaluated, no tradeoffs are noted. This is the most substantive open technical question.
- The API-token-free embedding path is flagged twice (tech-stack and roadmap) but never explained. It is unclear whether this means using a local embedding model, a different provider, or an Anthropic feature not yet available.
- There is no entry describing what "MCP server exposing tools" means in concrete terms: what the tool signatures look like, what arguments they accept, what they return. The MCP interface is the system's primary access layer but is entirely unspecified.
- There is no versioning or conflict-resolution strategy described for entries — if two agents write to the same concept, or if an entry's meaning drifts over time, there is no stated mechanism for handling that.
- The namespace field in the frontmatter schema is defined but its semantics are never explained. All current entries share the namespace `knowledge-system`, leaving its intended use (scoping, multi-tenant isolation, filtering) unstated.
- There is no description of what happens to Phase 1 entries that are poorly chunked, duplicative, or semantically overlapping when they are ingested into Phase 2. The migration is mentioned but not designed.
- The index.md rule ("always update after adding or changing an entry") creates a coordination problem for agent-written entries — agents must know to update it, but this parse entry itself was explicitly instructed not to update the index, suggesting the rule may already be under informal revision.

### Structural Observations About the Knowledge Itself

- The knowledge base is extremely young (all entries dated 2026-03-08, all created in a single session) and is currently more architectural than operational — it describes a system that does not yet fully exist.
- The entries are well-scoped and non-overlapping for their size, which validates the one-concept-per-file discipline working as intended at this scale.
- The parse entry format (this entry, and presumably a prior parse-agent-1) is itself an experiment in using agent-written synthesis as a knowledge artifact — the system is being used to observe and document itself, which is a meaningful signal about its intended maturity model.
- The absence of a `parse-agent-1.md` in the entries directory (despite this being `parse-agent-2`) is notable — either it was never written, was written outside the entries directory, or exists under a different slug. Its absence leaves a gap in the synthesis lineage.
