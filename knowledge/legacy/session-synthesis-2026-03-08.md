---
id: session-synthesis-2026-03-08
title: Session Synthesis — Full System State (2026-03-08)
tags: [synthesis, session-log, lossless, system-state]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

Complete system state snapshot as of the founding session (2026-03-08). Covers identity, architecture, active tooling, design rules, patterns, current state, and known gaps. Written as a compaction-safe handoff artifact — sufficient for a new session to reconstruct full capability without re-reading all 43 entries.

## Layer 2

### System Identity
Local-first, model-agnostic, session-irrelevant knowledge system for Claude. Content-agnostic, consumer-agnostic. Knowledge lives outside sessions — retrieved on demand. The session is a compute surface, not a memory surface.

### Architecture
Two-layer entry format: Layer 1 = concise summary (fits in context), Layer 2 = full content (deep storage). One concept per file, frontmatter required (id, title, tags, namespace, created, updated). Tags are the type system — `message`, `prompt`, `tool-call`, `script` determine embedding strategy and filtering.

Two phases:
- Phase 1 (now): Markdown files + Node.js scripts. Manual query. Seed data accumulation.
- Phase 2 (planned): Qdrant (local) + TypeScript MCP server + Anthropic embeddings. Semantic retrieval by meaning, not keyword.

### Active Tooling (all Node.js — permanent rule)
- `bootstrap.js`: Injects Layer 1 summaries into context at session start. Fail-silent.
- `verify.js`: Lossless security check — validates frontmatter, two-layer format, unique IDs.
- `purify.js`: Checks session transcript for unlogged decisions. `--write` auto-appends gaps.
- `generate-index.js`: Regenerates `index.md` from frontmatter. Run after every write.
- `update-status.js`: Patches `.claude/status.json`. Shared by hooks and scripts.
- `statusline.js`: Compact statusline — entry count, lossless %, context %, risk, compaction count.
- `tui.js`: External terminal panel watching `status.json` via `fs.watch`.
- `measure-bootstrap.js`: Reports L1 token footprint (~3.8k). Writes to `status.json`.

### Key Design Rules
- Nothing is lost to session boundaries — every insight is written immediately, not deferred.
- Purification has two levels: archival (raw prompts stored?) and semantic (knowledge extracted?). Only semantic counts as lossless.
- The primary agent is the only writer — subagents read only (permission boundary = accidental serialization, made intentional in Phase 2 via MCP single-write path).
- `MEMORY.md` is a pointer only — never a knowledge store.
- `index.md` is a generated artifact — always accurate via script, static file can drift.

### Key Patterns
- Parallel agent deep journeys: Load L1 (~4k tokens, ~2% context), run independent deep analysis across multiple agents simultaneously. Essentially free due to small top layer.
- Agent specialization via selective knowledge loading: Different agents initialized with different tag-filtered slices see different worlds.
- TUI ↔ Claude two-way channel: Claude writes `status.json` outward; TUI writes `action.json` inward via `UserPromptSubmit` hook.
- Chat is an antipattern for persistence: Generating knowledge in chat without writing to entries is loss. Write first, then acknowledge.

### Current State (2026-03-08)
- 43 entries, Phase 1 markdown.
- Founding session: 2026-03-08.
- Bootstrap context loaded at session start via `SessionStart` hook.
- Vector DB migration deliberately deferred — accumulating proven behavior first.

### Known Gaps (Phase 2 not yet built)
- Qdrant + MCP server.
- Chunking strategy (TBD).
- API-token-free embedding path (TBD).
- voyage-3 evaluation (flagged for future).
- Semantic purification as automated routine (prompt exists as stored tool call, not yet scheduled).
