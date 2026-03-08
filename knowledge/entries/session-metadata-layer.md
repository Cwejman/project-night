---
id: session-metadata-layer
title: Session Metadata Layer — Per-Session Introspection Store
tags: [design, session-log, introspection, future, architecture]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

Beyond storing human prompts, each session can have a metadata entry that logs session-level facts: UUID, name, start/end time, compaction count, entry count delta, agents spawned, risk peaks, and notes. This creates a second introspection layer — not what was said, but how the session ran.

## Layer 2

### Concept
Session-prompts entries capture *what was said*. A session-metadata entry captures *how the session ran* — a machine-readable audit trail of the session as a compute event.

### Candidate Fields
```yaml
session_id: <uuid>
session_name: <human or agent assigned>
date: 2026-03-08
started_at: 2026-03-08T04:22:24Z
ended_at: ~
compaction_count: 0
entries_added: 6
agents_spawned: 4
peak_context_risk: high
notes: []
```

### Value
- Cross-session analytics: which sessions were most productive, most costly, most lossy
- Compaction audit: how many times did this session compact, what was retained
- Agent coordination history: which parallel agent patterns were used
- Entry delta tracking: measure knowledge growth per session

### Relationship to Session-Prompts
Session-prompts = content layer (what was said)
Session-metadata = operational layer (how it ran)
Both keyed by the same session UUID. Together they form a complete session record.

### Implementation Path
Could be written by:
- The agent at session end (via purification routine)
- A PostToolUse hook accumulating stats into status.json, flushed at end
- A dedicated session-close routine (complement to bootstrap)

Not urgent — session-prompts and UUID identification come first. This is a natural next layer once those are stable.
