---
id: 25
title: Tool Call — tui.js
tags: [tool-call, script, tui, status]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Terminal status panel. Run in a separate pane: `node .claude/tui.js`. Watches `.claude/status.json` via fs.watch and re-renders on every change. Shows lossless status, entry count, context risk, compaction count, and active agents. Refreshes clock every 10s. No dependencies.

## Layer 2 — Implementation

File: `.claude/tui.js` — renders ANSI box panels from status.json. See file for full source.

Panels: LOSSLESS (verify status, errors, last check) · KNOWLEDGE (entry count, last added, index regen) · CONTEXT (risk level, compactions, session age, note) · AGENTS (active, last write, blocked writes)

Run: `node .claude/tui.js` in a split terminal or tmux pane. Stays running, updates live.
