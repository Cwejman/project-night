---
id: 04
title: Roadmap — Phases and Evolution
tags: [roadmap, phases, planning, muscles, portability, mcp, sub-agents]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-13
---

## Layer 1

Three-stage evolution. Stage 1 (current) — existing markdown system, functional but PoC-grade. Stage 2 (under reconsideration) — originally culture + claude plugin built from scratch in .md as PoC, but the markdown format itself is now being questioned: the bite model (weighted chunks without L1/L2 layers — see `multi-layer-embedding`) may not be well-served by one-concept-per-file markdown. Whether Stage 2 proceeds in markdown, a different structure, or skips to vector is an active exploration — not settled. Stage 3 (direction) — vector/weighted system. The core thing to prove remains cycle hardwiring: every cycle strictly writes to .night, nothing stays in context only. See `poc-cycle-hardwiring` for the PoC commitment and `monorepo-architecture` for structure.

## Layer 2 — Full Detail

### Stage 1 — Existing markdown system (current)

Storage: markdown files under `knowledge/entries/` (68 entries as of 2026-03-13)
Query: manual / grep / Claude reading files directly
Goal: functional, accumulating lore. Not being extended — becoming lore.

The existing system stays untouched. It is not migrated into the new structure; once the PoC is proven it becomes `lore/`.

### Stage 2 — Culture + Claude Plugin PoC (building next)

Built from scratch alongside the existing system. The core thing to prove: can every cycle be hardwired to .night? Full dialog, tool calls, everything — embedded at its semantically reasonable place. Not to claude memory, not in context only, to .night.

Storage: markdown files (same format, new directories: `culture/`, `claude/`, `lore/`)
Plugin: `claude/` is a Claude Code plugin — `hooks/hooks.json`, `.claude-plugin/plugin.json`, clean `.js` muscles
Sequence: culture session → claude plugin session → lore rename (existing entries → `lore/`)

The PoC may be scrapped once Stage 3 replaces it. That is acceptable and expected.

The L1/L2 two-layer model is a Stage 2 simplification. Full dialog storage makes L2 a strange metric as it grows. The right direction is L2 tagged and weighted in vector relationship to L1 — the .md format approximates but cannot implement this.

### Stage 3 — Vector/Weighted System (direction, not fixed plan)

Storage: Qdrant local instance (likely)
Interface: MCP server (one option, not settled as sole path)
Embeddings: Anthropic (voyage-3 candidate — evaluate at build time)
Migration: Stage 2 entries (culture + claude) inform Stage 3 design. Lore migrates as seed data.

---

### Evolution Gradient — Priority Order

Grounded in the 2026-03-12 session (prompts 21 and 27). The framing: *make core portable → accessible everywhere → protect it from its own pilot → understand the landscape → then build the integration layer.*

Final refined take (prompt 27): **global integration = build next, ecosystem research = learn next, everything else waits.**

**Concretised — immediate:**

1. **Monorepo restructure** — `@x/night` becomes a monorepo with three peer directories: `culture/`, `claude/`, `lore/`. `culture/` and `claude/` are built from scratch (not migrated). Existing `knowledge/entries/` stays untouched (becomes `lore/` later). Existing `.claude/` hooks stay in place until the new plugin replaces them. Build sequence: culture session first → claude plugin session second → lore rename deferred. `claude/` gets `.claude-plugin/plugin.json` + `hooks/hooks.json` — no `install.js` needed. Install at user scope: `/plugin install ./claude`. This IS global integration — hooks fire everywhere once installed. See `monorepo-architecture` for full detail.

2. **Pre-write validation muscle** — a hook that validates frontmatter/naming/two-layer format before any entry is written. Protects the system from convention violations by its own pilot. The session-prompt naming violation showed this gap.

**Concrete next step for learning:**

4. **Ecosystem research session** — a dedicated session of compound web searches: how context management actually works, what Letta/Graphiti/Zep/Mem0 do mechanically, how Claude Code compaction works under the hood, what the hook system can and can't do. Not ad hoc — a dedicated fresh session with freedom to chain searches. Grounds all subsequent decisions.

**After 1–4 are done:**

5. **Operational portability gap (write-side)** — once global integration exists, the agent also needs to be able to write/verify/measure outside core (not just read). Mechanism not yet designed.

6. **MCP** — only when symlinks aren't enough (semantic search, write-back from projects, cross-project queries). By then requirements are proven, not speculated. See Stream 1 below for the original plan and what has changed.

**Sub-agent workflows (independently useful, no dependency on above):**

7. Reverse prompting — validates the write path, immediately improves semantic completeness. Can progress in parallel.
8. Parallel deep dives — formalizes the parse experiment pattern. Scales with retrieval improvements.

**Direction — form not settled:**

9. Vector storage and semantic retrieval — answer after usage patterns are clear. What is NOT in scope until that design is done: Qdrant schema, chunking strategy, embedding model selection.
10. The relationship between muscles and platform — hooks are the current mechanism (pragmatic, Claude-specific). How enforcement becomes platform-agnostic is an open question.

---

### Stream 1 — MCP Integration (under revision as of 2026-03-12)

> **Status:** The specific approach below (convert all scripts to MCP tools) was questioned during the 2026-03-12 architecture session. The NEEDS it addresses are valid. The HOW is open. See `operational-discoveries-2026-03-12`.

**Original goal (2026-03-08):** convert the seven Node.js scripts into a TypeScript MCP server, exposed as native tools within Claude Code sessions.

**What's still valid — the needs:**
- Single write path for transaction semantics
- Integrity guarantees (verify on every store)
- Sub-agents able to access knowledge without relying on the primary agent as intermediary
- Cross-project knowledge access (the operational portability gap)

**What's been questioned — the approach:**
- Whether ALL scripts should become MCP tools, or whether muscles (enforcement) should stay as hooks-invoked .js while MCP serves knowledge access only
- Whether MCP is the right mechanism for cross-project access, or whether filesystem teleportation (symlinks) is simpler and sufficient first
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

**Search strategy (Option D — still valid):** MCP search() does keyword + tag filtering, returns top-K candidates into Claude's context, Claude's own reasoning does final selection. No external embedding cost, no extra dependencies.

---

### Stream 2 — Sub-agent Workflows

**Pattern A — Reverse Prompting**
An agent reads a knowledge entry and reconstructs what the original human instruction must have been, then compares against stored session prompts. Divergence = semantic gap. One sub-agent, serial, invoked at session close or on-demand. The semantic completeness check — not just "is the prompt stored?" but "does the stored knowledge reproduce the prompt's meaning?"

**Pattern B — Parallel Deep Dives**
Multiple agents each load their assigned topic cluster, dive into L2 for their cluster only, return structured synthesis objects `{cluster, gaps, insights, confidence}`. Primary agent is sole writer. Prototyped in the parse experiment (founding session, 4 agents). With MCP, per-agent context cost drops from full bootstrap (~4.7k tokens) to a targeted cluster search (~500–1000 tokens).

**Build order:** reverse prompting first (validates write path, immediately improves quality), parallel deep dives second (formalizes the parse experiment pattern).

---

### Open Design Questions

- API-token-free embedding path with Anthropic
- Chunking strategy (fixed / sentence / semantic) — Phase 2 design question, not Phase 1 blocker
- Routine placement: verify/purify need agent presence to act on results — session end is wrong; correct triggers not yet designed
- The right vector structure: current L1/L2 split is one-dimensional and a markdown-phase approximation. In the vector DB, everything is vectors — the layer distinction dissolves, and structure emerges from semantic proximity rather than imposed tiers. Design from observed usage patterns after Phase 1 accumulation.

### Stage 3 considerations (exploratory, not fixed)

When knowledge moves to the vector DB, the human browsability that markdown provides for free must be replaced. A web console (or connectable TUI) becomes a requirement — being able to navigate entries and see the file-layer (git-tracked muscles and plugin) alongside the knowledge layer. The DB is hypothesized to be atomic like commits — each knowledge mutation a versioned event rather than a file overwrite, the semantic analogue of git history for knowledge. Whether these two timelines are ever surfaced as a unified view is an open question.
