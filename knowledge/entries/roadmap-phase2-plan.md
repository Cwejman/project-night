---
id: roadmap-phase2-plan
title: Phase 2 Roadmap — Priorities and Plan (2026-03-08)
tags: [roadmap, planning, mcp, sub-agents, priority]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

Two prioritized streams: (1) MCP integration — converting Node.js scripts into a proper MCP server with routine hooks for system integrity; (2) sub-agent workflows — reverse prompting for semantic validation, parallel deep dives for knowledge synthesis. Filesystem stays as storage for now. Vector DB structure (beyond the current L1/L2 simplification) is an open design question to solve when that layer is actually built. Human steers; system supports.

## Layer 2

### Current Phase

Still Phase 1 (filesystem). The deliberate buildup continues. The L1/L2 two-layer model is a pragmatic Phase 1 simplification — not the final embedding structure. When vector storage is built, the dimensionality question (nesting, multi-dimensional structure) should be designed fresh, informed by actual usage patterns accumulated in Phase 1.

---

### Stream 1 — MCP Integration

**Goal:** convert the seven Node.js scripts into a TypeScript MCP server, exposed as native tools within Claude Code sessions. Self-hosting principle applies: each tool is written as a knowledge entry first; the server is assembled from entries.

**Why this matters for system integrity:**
- Single write path makes transaction semantics explicit (currently an accidental side effect of the permission boundary)
- Routine hooks (verify on every store, purification on session close) become first-class, not optional scripts
- Sub-agents can call tools directly rather than relying on the primary agent as intermediary

**Script-to-tool mapping:**
| Script | MCP tool | Key change |
|---|---|---|
| bootstrap.js | search(query, namespace, k) + session init | Pull replaces push; agents query what they need |
| verify.js | embedded in store() pre-write hook | Atomic integrity check on every write |
| purify.js | purify() | Callable by sub-agents, not just primary |
| generate-index.js | list() | Index is a live query, not a generated file |
| update-status.js | server event emitter | Remains external |
| measure-bootstrap.js | token_count(namespace, layer) | On-demand |
| new-entry.js | store(content, metadata) | Single write path with embedded verify |

**Search strategy (Option D):** MCP search() does keyword + tag filtering, returns top-K candidates into Claude's context, Claude's own reasoning does final selection. No external embedding cost, no extra dependencies. First-class to Claude Code — the semantic intelligence lives in the session.

**Build order within Stream 1:**
1. Write MCP tool entries (each tool as a knowledge entry, Layer 2 = TypeScript implementation)
2. Assemble server from entries
3. Wire into Claude Code via MCP settings
4. Retire individual Node.js scripts one by one as tools go live

---

### Stream 2 — Sub-agent Workflows

**Goal:** two patterns that together provide deeper knowledge validation and synthesis than any single-agent session can produce.

**Pattern A — Reverse Prompting**
An agent reads a knowledge entry and reconstructs what the original human instruction must have been, then compares against stored session prompts. Divergence = semantic gap. One sub-agent, serial, invoked at session close or on-demand. This is the semantic completeness check — not just "is the prompt stored?" but "does the stored knowledge reproduce the prompt's meaning?"

**Pattern B — Parallel Deep Dives**
Multiple agents each load their assigned topic cluster, dive into L2 for their cluster only, return structured synthesis objects `{cluster, gaps, insights, confidence}`. Primary agent is sole writer. Prototyped in the parse experiment (founding session, 4 agents). With MCP, per-agent context cost drops from full bootstrap (~4.7k tokens) to a targeted cluster search (~500–1000 tokens). 10+ parallel agents become practical.

**Build order:** reverse prompting first (validates write path, immediately improves quality), parallel deep dives second (formalizes the parse experiment pattern).

---

### Open Design Question — Vector Structure

The current L1/L2 split is a one-dimensional simplification. The real structure of knowledge is richer: entries relate to each other across multiple dimensions (topic, time, type, confidence, source). When the vector layer is built, this should be designed from observed usage patterns — not assumed upfront. The right structure will be evident after months of Phase 1 accumulation.

What is NOT in scope until that design is done: Qdrant schema, chunking strategy, embedding model selection. These are Phase 2 design questions, not Phase 1 blockers.

---

### Priority Order

1. MCP server — Stream 1 infrastructure, unblocks everything
2. Reverse prompting — Stream 2 Pattern A, immediately useful, validates MCP
3. Parallel deep dives — Stream 2 Pattern B, high leverage once MCP retrieval is cheap
4. Vector storage design — open question, answer after usage patterns are clear
