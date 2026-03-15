---
id: 34
title: Tool Call — purify.js
tags: [tool-call, script, purification, lossless, prompts]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Purification routine — the outward complement to bootstrap. Bootstrap loads knowledge INTO context. Purify checks what in the session transcript has NOT been persisted OUT to knowledge. Reads the JSONL session transcript, extracts human prompts, compares against stored session-prompts entries, reports any unlogged. Run with --write to auto-append gaps to today's entry.

## Layer 2 — Implementation

File: `.claude/purify.js`

```
node .claude/purify.js          # report unlogged prompts
node .claude/purify.js --write  # report + auto-append to session-prompts-<date>.md
```

Transcript path: read from status.json (transcript_path field, written by Stop hook input — but note: allowlist in update-status.js currently blocks this field). Fallback: finds most recent .jsonl in ~/.claude/projects/<slug>/.

### The bootstrap ↔ purify duality

| Direction | Script | Action |
|---|---|---|
| Inward | bootstrap.js | Loads Layer 1 summaries into context at session start |
| Outward | purify.js | Checks session transcript for unlogged human prompts |

Together they form the lossless guarantee loop: bootstrap ensures knowledge reaches Claude, purify ensures Claude's session reaches knowledge.

### Integration

Should be run as part of the doctor/health check routine, and ideally wired to the Stop hook alongside verify.js. The Stop hook sequence: verify → purify → update-status.

### Note on transcript_path

The JSONL transcript path is available in the Stop hook's stdin JSON. Currently filtered out by update-status.js allowlist. To use it in purify, either: (a) add transcript_path to the allowlist, or (b) have purify discover the transcript by scanning ~/.claude/projects/.
