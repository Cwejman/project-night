---
id: 27
title: Tool Call — statusline.js
tags: [tool-call, script, statusline, tui]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Claude Code statusline script. Reads session JSON from stdin (context_window.remaining_percentage, model, etc.) and status.json from the nearest .claude/ directory. Outputs a single compact line: entry count, lossless status, context % remaining, risk level, compaction count. Configured globally in ~/.claude/settings.json so it is always visible across all Claude sessions.

## Layer 2 — Implementation

File: `.claude/statusline.js`
Configured in: `~/.claude/settings.json` as `statusLine.type: "command"`

Output format: `◈ 28 ✓  │  rem 77%↓  │  ▼  │  ⟳1`

- `◈ N` — knowledge system active, N entries
- `✓` / `✗N` / `?` — lossless pass / fail (N errors) / unknown
- `rem N%↓` / `rem N%↑` — context window remaining; arrow is dynamic trend (↓ = remaining shrinking, ↑ = increased e.g. post-compaction, no arrow = first render). Green >40%, yellow 20-40%, red <20%. Previous value stored in status.json as `context.lastCtxPct`.
- `▼` / `◆` / `▲` — risk low / medium / high
- `⟳N` — compaction count (shown only if >0)

Finds status.json by walking up from cwd — works across all projects that have a .claude/ directory. Degrades gracefully if no status.json found (shows ctx % only).
