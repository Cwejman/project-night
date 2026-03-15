---
id: 30
title: TUI Architecture — External Wrapping vs Internal Statusline
tags: [tui, architecture, tmux, statusline, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Two valid TUI surfaces: internal (Claude Code's own statusline, always visible within the Claude UI) and external (tmux status bar wrapping Claude, visible regardless of what Claude is doing). Both read from status.json. External wrapping is policy-compliant — it only reads files, never bypasses Claude. The zsh statusline is NOT visible while Claude Code runs (Claude owns the terminal); tmux is the correct external wrapper.

## Layer 2 — Full Detail

### Why zsh statusline doesn't work here

Claude Code takes over the TTY when running interactively. The zsh prompt (and its statusline/RPROMPT) is only visible between Claude invocations. Once Claude Code is running, zsh's display layer is hidden. Not useful for always-on status.

### The correct external surface: tmux

tmux has a persistent status bar rendered outside any pane's content. It is always visible regardless of what runs inside the pane — including Claude Code. A tmux status bar script that reads status.json and refreshes every second gives truly always-on visibility.

```
╔════════════════════════════════════════════════╗
║  Claude Code (full pane)                       ║
╠════════════════════════════════════════════════╣
║ ◈ 29 ✓  │  ctx 77%  │  ▼  │  W▸0.3s  V▸1.2s ║  ← tmux status bar
╚════════════════════════════════════════════════╝
```

### Is external wrapping policy-compliant?

Yes. tmux is a terminal multiplexer — it has no access to Claude's internals, APIs, or model outputs. It only reads files (status.json) that agents write voluntarily. No policy violation.

### Interactivity: sending actions to Claude from the TUI

Achievable via UserPromptSubmit hook + a command queue file:
1. External TUI writes `{"action": "verify"}` to `.claude/action.json`
2. `UserPromptSubmit` hook reads action.json, appends a context note to Claude's next prompt
3. Claude sees the action and responds
This is file-based command injection — no API bypass, fully transparent.

### Decision: tmux deprioritized

During the founding session, tmux integration was evaluated and explicitly declined. The Claude Code internal statusline (always visible within the Claude UI) combined with the TUI pane (`tui.js`) was judged sufficient and already "beautiful." tmux remains a valid future surface but is not planned.

### The two-surface architecture (current)

| Surface | Visibility | Interaction | Setup |
|---|---|---|---|
| Claude statusline | While Claude is focused | Read only | settings.json |
| TUI pane (tui.js) | When pane is open | Full / interactive (Phase 2) | manual |
| tmux status bar | Always — deprioritized | Read only | not planned |
