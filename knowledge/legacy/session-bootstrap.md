---
id: 10
title: Session Bootstrapping — Knowledge Injection via Hooks
tags: [bootstrap, hooks, session, claude-code]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Claude Code's `SessionStart` hook injects knowledge system content into context at session start and after compaction. Any stdout from the hook command is added to Claude's context automatically. This closes the gap between session irrelevance as a design value and the reality that a new session must actively load the knowledge system.

## Layer 2 — Full Detail

### Hook mechanism

Claude Code fires `SessionStart` with a `source` field:
- `"startup"` — new session begins
- `"resume"` — session resumed
- `"clear"` — after /clear
- `"compact"` — after context compaction

Any text written to **stdout** by the hook command is injected into Claude's context. JSON output can use `additionalContext` for more control.

### Bootstrap strategy

A hook script reads the knowledge index and critical entry summaries (Layer 1 only) and writes them to stdout. This gives every new session immediate awareness of the knowledge base without requiring manual file reads.

The hook fires on both `startup` and `compact` — ensuring knowledge survives compaction, which is the other half of the session irrelevance problem.

### Configuration location

Project-scoped: `.claude/settings.json` in the project root.
User-scoped (all projects): `~/.claude/settings.json`

For this system: project-scoped at `/Users/jcwejman/git/@x/night/.claude/settings.json`

### Hook config format

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/jcwejman/git/@x/night/.claude/bootstrap.js"
          }
        ]
      }
    ]
  }
}
```

Matcher is a regex string — `"startup|compact"` correctly fires on both new sessions and after compaction. Valid source values: `startup`, `resume`, `clear`, `compact`. Use `""` or `"*"` to match all.

### Bootstrap script responsibility

The bootstrap script (`bootstrap.js`) should:
1. Read `knowledge/index.md`
2. Read the Layer 1 summary from each entry
3. Output a compact context block to stdout

It must be fast and produce minimal output — only Layer 1 summaries, not full Layer 2 content. Full entries are fetched on demand during the session.

### Implementation

See tool-call entry: `bootstrap-script` (to be created).
