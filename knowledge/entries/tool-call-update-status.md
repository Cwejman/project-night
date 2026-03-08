---
id: 26
title: Tool Call — update-status.js
tags: [tool-call, script, status, hooks]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Shared status.json patcher called by hooks and scripts. Supports flags: `--init`, `--verify`, `--entries`, `--compact`, `--pre-compact`, `--risk <level>`, `--note <text>`, `--last-entry <slug>`. Also accepts JSON patch via stdin. Atomic write to `.claude/status.json`.

## Layer 2 — Implementation

File: `.claude/update-status.js`

```
--init          initialise session (startTime, risk=low)
--verify        run verify.js and patch lossless status
--entries       count entries dir and patch knowledge.entryCount
--compact       increment compactions, set risk=low
--pre-compact   set risk=high, note="compaction imminent"
--risk <val>    set context.risk (low|medium|high|unknown)
--note <val>    set context.note
--last-entry    set knowledge.lastEntry + lastIndexRegen=now
stdin JSON      deep-merged into status (for custom patches)
```

Called by hooks in `.claude/settings.json`:
- `SessionStart startup` → `--init --verify --entries`
- `SessionStart compact` → `--compact --verify --entries`
- `PreCompact` → `--pre-compact`
- `Stop` → `--verify --entries`
