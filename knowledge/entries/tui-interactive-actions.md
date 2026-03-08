---
id: 33
title: TUI Interactive Actions — Command Queue to Claude
tags: [tui, interactive, actions, hooks, command-queue]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The TUI can send actions to Claude via a file-based command queue. External process writes to `.claude/action.json`; a UserPromptSubmit hook reads it and appends the action as context to Claude's next prompt. This creates a two-way channel: Claude writes status.json outward, external TUI writes action.json inward.

## Layer 2 — Full Detail

### Architecture

```
TUI / external process
        │  writes
        ▼
  .claude/action.json
        │  read by
        ▼
  UserPromptSubmit hook
        │  appends to prompt context
        ▼
        Claude
```

### action.json schema

```json
{
  "action": "verify|search|summarize|add-entry",
  "payload": "optional string or object",
  "ts": "ISO",
  "consumed": false
}
```

Hook sets `consumed: true` after reading. TUI watches for consumed=true to confirm delivery.

### Hook behavior

UserPromptSubmit hook reads action.json. If `consumed: false`, it appends to stdout (injected into Claude's context):
```
[ACTION QUEUED]: verify — run verify.js and report result
```
Then marks consumed. Claude sees this as part of the prompt context and acts on it.

### Available actions (Phase 1)

| Action | Effect |
|---|---|
| `verify` | Claude runs verify.js and reports |
| `status` | Claude reads and reports current status.json |
| `search <query>` | Claude searches knowledge entries |
| `add-pending N` | Increments loss.pending by N |
| `note <text>` | Appends a context note |

### Policy compliance

No API bypass. The action queue is just a file. Claude reads it as context — the same as a user typing a message. Fully transparent and auditable.

### Phase 2

When the MCP server exists, actions become MCP tool calls sent directly to the server. The file queue becomes a proper API. The TUI gains a socket or HTTP connection to the MCP server.
