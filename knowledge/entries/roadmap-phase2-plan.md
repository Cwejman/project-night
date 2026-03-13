---
id: roadmap-phase2-plan
title: Evolution Plan — Priorities and Open Questions
tags: [roadmap, planning, mcp, sub-agents, priority, muscles, portability]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-13
---

## Layer 1

Evolution priorities, distinguishing what's concretised from what's explored. Immediate: muscles strengthen — .js + hooks (current mechanism, pragmatic, not necessarily permanent given model-agnostic values). The operational portability gap must be addressed — culture travels globally but write/verify/measure is pinned to core. Cross-project knowledge access mechanism is open (MCP, filesystem teleportation, both). Sub-agent workflows (reverse prompting, parallel deep dives) remain valid and progress independently. Vector DB and semantic retrieval are a direction with understood requirements, not a fixed plan. Stream 1 from the original 2026-03-08 plan (convert all scripts to MCP tools) is under revision — the needs it addressed are valid but the specific approach has been questioned. Human steers; system supports.

## Layer 2

### Current Phase

Still Phase 1 (filesystem). The deliberate buildup continues. The L1/L2 two-layer model is a pragmatic Phase 1 simplification — not the final embedding structure. When vector storage is built, the dimensionality question (nesting, multi-dimensional structure) should be designed fresh, informed by actual usage patterns accumulated in Phase 1.

---

### Stream 1 — MCP Integration (under revision as of 2026-03-12)

> **Status:** The specific approach below (convert all scripts to MCP tools) was questioned during the 2026-03-12 architecture session. The NEEDS it addresses are valid. The HOW is open. See `operational-discoveries-2026-03-12` for the current operational understanding.

**Original goal (2026-03-08):** convert the seven Node.js scripts into a TypeScript MCP server, exposed as native tools within Claude Code sessions.

**What's still valid — the needs:**
- Single write path for transaction semantics
- Integrity guarantees (verify on every store)
- Sub-agents able to access knowledge without relying on the primary agent as intermediary
- Cross-project knowledge access (the operational portability gap)

**What's been questioned — the approach:**
- Whether ALL scripts should become MCP tools, or whether muscles (enforcement) should stay as hooks-invoked .js while MCP serves knowledge access only
- Whether MCP is the right mechanism for cross-project access, or whether filesystem teleportation (symlinks) is simpler and sufficient
- Whether binding muscles to any specific platform (Claude hooks now, MCP later) is aligned with model-agnostic values long-term

**Original script-to-tool mapping (2026-03-08, preserved for reference):**
| Script | MCP tool | Key change |
|---|---|---|
| bootstrap.js | search(query, namespace, k) + session init | Pull replaces push; agents query what they need |
| verify.js | embedded in store() pre-write hook | Atomic integrity check on every write |
| purify.js | purify() | Callable by sub-agents, not just primary |
| generate-index.js | list() | Index is a live query, not a generated file |
| update-status.js | server event emitter | Remains external |
| measure-bootstrap.js | token_count(namespace, layer) | On-demand |
| new-entry.js | store(content, metadata) | Single write path with embedded verify |

**Search strategy (Option D — still valid):** MCP search() does keyword + tag filtering, returns top-K candidates into Claude's context, Claude's own reasoning does final selection. No external embedding cost, no extra dependencies. The semantic intelligence lives in the session.

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

### Priority Order (revised 2026-03-13)

**Concretised — immediate:**
1. Muscles strengthen — close the gap between documented rules and enforced rules. .js + hooks is the current mechanism.
2. Address the operational portability gap — the agent needs to be able to write/verify/measure outside core.

**Explored — next, mechanism open:**
3. Cross-project knowledge access — MCP, filesystem teleportation, or both. Driven by actual multi-project need.
4. Reverse prompting — Stream 2 Pattern A, independently useful, no infrastructure dependency.
5. Parallel deep dives — Stream 2 Pattern B, scales with retrieval improvements.

**Direction — form not settled:**
6. Vector storage and semantic retrieval — answer after usage patterns are clear.
7. The relationship between muscles and platform — how enforcement becomes platform-agnostic.
