---
id: tui-action-queue-state
title: TUI Action Queue — Implementation State
tags: [tui, interactive, actions, hooks, implementation-state]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

The two-way action channel is architecturally complete but has no UX layer. hook-prompt.js reads action.json on UserPromptSubmit and injects queued actions into Claude's context. However, the TUI is read-only (no keypress handling) and there are no keyboard shortcuts — actions can only be sent by manually writing to action.json. The shortcut/interactive layer is unbuilt.

## Layer 2

### What is built
- `hook-prompt.js`: reads `.claude/action.json` on every `UserPromptSubmit`. If unconsumed action found, injects it as `additionalContext` JSON to Claude's stdin. Marks `consumed: true` after reading. Wired via `UserPromptSubmit` hook in `.claude/settings.json`.
- `tui.js`: full read-only panel watching `status.json`. Full mode + `--compact` mode. No input handling.

### What is NOT built
- TUI interactive input (readline / keypress) — the TUI has no way to accept keypresses
- Keyboard shortcuts to write to `action.json` — no keybindings in `~/.claude/settings.json`
- Predefined action vocabulary (e.g. `purify`, `verify`, `measure`) — action.json format works but no UI to trigger them

### To send an action today
Manually write to action.json before submitting a prompt:
```sh
echo '{"action":"purify","ts":"2026-03-08T12:00:00Z"}' > .claude/action.json
```
Next prompt submission will inject it into Claude's context.

### To complete the UX layer
Option A — Interactive TUI: add `readline`/`process.stdin` keypress handling to `tui.js`. Map keys to predefined actions that write to `action.json`.
Option B — Shell aliases/shortcuts: define zsh aliases or keybindings that write specific actions to `action.json` without touching the TUI.
Option C — Claude Code keybindings: use `~/.claude/keybindings.json` to map chords to slash commands that trigger actions.

Option B is lowest friction to implement. Option C is most native to Claude Code.
