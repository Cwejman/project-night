---
id: 24
title: TUI Status Panel — Live Agent and System Feedback
tags: [tui, architecture, mcp, lossless, context, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

A terminal status panel (TUI) that shows live system state to the operator: context health, lossless status, entry count, active agents, and compaction risk. Agents write to a shared `status.json`; the TUI watches and renders it. Reduces cognitive load — the operator never has to ask "what state is the system in?"

## Layer 2 — Full Detail

### What it displays

| Panel | Data | Source |
|---|---|---|
| Context | Token usage, compaction risk, session age | Claude Code hooks (SessionStart, PreCompact) |
| Lossless | Last verify result, error count, time since last check | verify.js output → status.json |
| Knowledge | Entry count, last entry added, last index regenerated | generate-index.js → status.json |
| Agents | Active subagents, last tool call, write attempts blocked | Hook events → status.json |
| MCP (Phase 2) | Server up/down, queries/min, last search, store operations | MCP server → status.json |

### Architecture

```
Hooks / MCP / scripts
        │
        ▼
  .claude/status.json   ← shared state, written by agents/hooks
        │
        ▼
   tui.js (watcher)     ← fs.watch() → re-render on change
        │
        ▼
  Terminal pane          ← operator's second terminal or tmux split
```

### status.json schema

```json
{
  "session": {
    "startTime": "ISO",
    "compactions": 0,
    "lastCompact": null
  },
  "context": {
    "risk": "low|medium|high",
    "note": "string"
  },
  "lossless": {
    "lastVerify": "ISO",
    "status": "pass|fail|unknown",
    "errors": 0
  },
  "knowledge": {
    "entryCount": 25,
    "lastEntry": "slug",
    "lastIndexRegen": "ISO"
  },
  "agents": {
    "active": [],
    "lastWrite": null,
    "blockedWrites": 0
  }
}
```

### Hook integration

- `SessionStart` (startup): initialise status.json, set session.startTime
- `SessionStart` (compact): increment compactions, update context.risk to low
- `PreCompact`: set context.risk to high, write warning
- `PostToolUse` (Write): update knowledge.lastEntry, trigger index regen
- `Stop`: run verify.js, write lossless status

### Self-hosting

The TUI implementation (tui.js) is stored as a knowledge entry: `tool-call-tui`.
status.json is a runtime artifact, not a knowledge entry.

### Cognitive load reduction

The operator never needs to manually run verify.js or wonder about context state. The TUI makes system health continuously visible. This is the lossless guarantee made perceptible.
