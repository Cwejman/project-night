---
id: 43
title: Context Metrics — Remaining vs Headroom to Auto-Compact
tags: [context, tui, statusline, metrics, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Two different context metrics exist: remaining percentage (raw window left) and headroom to auto-compact (how far above the compaction trigger). Claude Code shows headroom; the statusline shows remaining. They can diverge significantly — 26% remaining with only 12% headroom if the compaction threshold is ~14%. The dangerous number for risk assessment is headroom, not remaining. The statusline risk indicator should track headroom when available.

## Layer 2 — Full Detail

### The calculation

```
Claude Code "until auto-compact" = remaining% − auto-compact threshold%
Example: 26% remaining − 14% threshold = 12% headroom
```

Auto-compact fires before the window is full. The exact threshold is not exposed in the statusline stdin JSON (only `remaining_percentage` is available). It can be inferred: `headroom = remaining − threshold`, where threshold ≈ `remaining − displayed_headroom`.

### Risk implications

| Remaining % | Headroom % | Risk |
|---|---|---|
| >40% | >25% | Low |
| 26% | 12% | Medium-High — compaction is near |
| <20% | <5% | High — PreCompact hook imminent |

The statusline currently shows remaining% as the risk signal. This understates risk when the compaction threshold is significant. A session at 26% remaining feels safe but is actually 12% from compaction.

### Fix

The PreCompact hook fires before compaction — use it as the authoritative "high risk" signal. When PreCompact fires, set `context.risk = "high"` in status.json regardless of remaining%. This is already implemented in `update-status.js --pre-compact`. Trust the hook, not the percentage.

### Session note

Discovered at end of founding session (2026-03-08) when Claude Code showed "12% until auto-compact" while statusline showed "26% remaining." Both correct; different baselines. Session ended shortly after to avoid unplanned compaction mid-work.
