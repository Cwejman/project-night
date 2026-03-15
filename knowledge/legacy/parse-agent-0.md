---
id: 06-agent-0
title: Knowledge Parse — Agent 0 (primary)
tags: [parse, synthesis, experiment]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

A local-first, model-agnostic, session-irrelevant knowledge system for Claude, built in two phases: a structured markdown file store now, migrating to Qdrant + MCP server later. Its core architectural bet is that memory belongs outside the session — in a queryable, persistent layer — so context compaction and bloat become non-problems. Tech stack is settled (Qdrant, Anthropic embeddings, TypeScript MCP); structure is enforced (one concept per file, frontmatter schema, index always current); and MEMORY.md is strictly a pointer, never a knowledge store.

---

## Layer 2 — Deep Parse (full observations)

### What is explicitly stated

- **Vision**: first-class, model-agnostic, content-agnostic, Claude-native (MCP), local-first, semantic retrieval
- **Not** a documentation tool — a persistent queryable memory layer
- **Phase 1**: markdown files, manual/grep/Claude query, seed data for Phase 2
- **Phase 2**: Qdrant local, MCP server (store/search/update/delete), Anthropic embeddings, TypeScript
- **Metadata schema**: id, title, tags, namespace, created, updated
- **Rules**: one concept per file, index always updated, MEMORY.md pointer-only, consult index before adding
- **Session irrelevance**: session = compute surface only; memory lives externally

### What is implied but not stated

- The MCP server is the primary runtime interface — Claude will never directly query files in Phase 2
- Phase 1 entries are implicitly the schema/data contract for Phase 2 ingestion; structure choices now have downstream consequences
- "API-token-free path" for Anthropic embeddings is unresolved but treated as a design constraint, not a nice-to-have — suggesting the system should work without a separate Anthropic API key beyond Claude Code itself
- voyage-3 is deferred but the fact it is named suggests it is the likely embedding model for Phase 2
- The MEMORY.md pointer rule implies that Claude's auto-memory system is not trusted as a knowledge store — it is treated as volatile or lossy by design

### Cross-entry connections

- `vision` + `session-irrelevance`: together they define the philosophical core — the system exists to make Claude stateless at the session level but stateful at the knowledge level
- `tech-stack` + `roadmap`: the "TBD" on chunking is the only unresolved structural decision that could affect both embedding quality and MCP tool design
- `markdown-phase` + `roadmap`: Phase 1 entries are the migration seed — meaning the frontmatter schema defined now must be compatible with Qdrant metadata fields later
- `tech-stack` + `session-irrelevance`: TypeScript MCP is the delivery mechanism for the session-irrelevance property — without the MCP server, knowledge retrieval requires manual file reads, which is not scalable

### Gaps and unresolved questions

1. **Chunking strategy**: the most consequential open question — will each `.md` entry be one chunk, or will entries be split? This affects retrieval precision
2. **Embedding API path**: how does Anthropic embedding work without a separate token? Claude Code SDK? Proxy? This needs resolution before Phase 2 begins
3. **Search interface**: what does a search MCP tool call look like? What parameters, what return shape?
4. **Namespace usage**: defined in schema but no entries use distinct namespaces — all are `knowledge-system`. How will namespaces be used for filtering?
5. **Update/delete semantics**: how are existing entries updated in Phase 2? Re-embed on change? Soft delete?
6. **No auth/multi-user concern**: system is single-user by design, but this is implicit — never stated

### Structural observations about the knowledge itself

- 5 entries, all in one namespace, all created same day — very early stage
- The knowledge is self-referential (all entries are about the system building the system)
- Entry quality is consistent: concise, schema-valid, no fluff
- The two-layer structure (this parse experiment) is itself a test of a retrieval pattern — top layer for fast semantic match, deep layer for precise retrieval
- The experiment of running 4 parallel parses (3 subagents + primary) is the first live test of multi-agent coordination over this knowledge base
