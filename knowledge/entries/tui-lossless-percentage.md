---
id: 32
title: TUI Lossless Percentage — Context vs Persisted
tags: [tui, lossless, context, tracking]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Loss percentage: ratio of knowledge-worthy events in the current session that have NOT yet been written as entries. Tracked via a "pending" counter in status.json. Agents increment pending on significant decisions/insights; writing an entry decrements it. Displayed as a percentage or highlight count in the TUI.

## Layer 2 — Full Detail

### What counts as a loss event

- A design decision made in conversation but not yet written
- A human prompt with novel content not yet stored as a message entry
- A gap identified (e.g. by verify.js) not yet resolved

### Tracking mechanism

status.json gains:
```json
"loss": {
  "pending": 3,
  "written": 26,
  "percentage": 10
}
```

`pending` is incremented by the agent (or hooks) when a noteworthy event occurs without an immediate write. `written` is the entry count. `percentage = pending / (pending + written) * 100`.

### TUI display

```
◈ 29 ✓ 3▲  │  ctx 77%  │  ...
```
`3▲` = 3 pending items not yet written. Red if >0, green if 0. This makes loss visible at a glance.

### Phase 1 limitation

In Phase 1, pending tracking is semi-manual — the agent increments it explicitly. In Phase 2, the MCP server can track this automatically by comparing session context to stored entries.
