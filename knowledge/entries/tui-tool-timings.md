---
id: 31
title: TUI Tool Call Timings — PostToolUse Hook
tags: [tui, tool-calls, timings, hooks, performance]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

PostToolUse hook captures tool call name and duration, writes the last N timings to status.json. TUI displays them as a minimal right-side strip: one symbol per tool type + duration. Gives real-time visibility into agent activity and performance.

## Layer 2 — Full Detail

### Hook input

PostToolUse stdin JSON includes: `tool_name`, `tool_input`, `tool_response`, `duration_ms` (Claude Code provides timing).

### Tool symbol map (one char)

| Symbol | Tool |
|---|---|
| W | Write |
| E | Edit |
| R | Read |
| G | Glob |
| S | Grep (search) |
| B | Bash |
| V | verify.js |
| I | generate-index.js |
| A | Agent |

### Display format (right side, minimal)

```
W▸0.3  E▸0.1  V▸1.2
```
Last 3 tool calls, seconds. Color: green <1s, yellow 1-5s, red >5s.

### status.json additions

```json
"toolTimings": [
  { "tool": "W", "ms": 312, "ts": "ISO" },
  { "tool": "V", "ms": 1240, "ts": "ISO" }
]
```
Ring buffer of last 8 entries.
