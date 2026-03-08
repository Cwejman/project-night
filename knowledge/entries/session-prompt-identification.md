---
id: session-prompt-identification
title: Session Prompt Identification — UUID vs Date vs Hybrid
tags: [design, session-log, conventions, purification, tool-call]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

Sessions have a machine-readable `sessionId` UUID (found in JSONL, e.g. `3b054304-acad-4830-b766-0d18cf655d63`). No human-readable name field exists natively in the session file format. Recommended convention: hybrid slug `session-prompts-<date>-<uuid-prefix>` for uniqueness + readability. The sessionId can be read from the JSONL and used as a cross-reference field in session-prompts entries.

## Layer 2

### What Exists
Claude Code stores sessions as JSONL files at:
`~/.claude/projects/<project-slug>/<sessionId>.jsonl`

Each message record contains:
```json
{
  "sessionId": "3b054304-acad-4830-b766-0d18cf655d63",
  "type": "user",
  ...
}
```

There is no `title` or `name` field in the JSONL format. The Claude Code UI auto-generates a display title from early messages, but this is not persisted in the file format and is not programmatically settable via a simple mechanism.

### Current Problem
The current session-prompts entry uses a date slug (`session-prompts-2026-03-08`). This is not unique — multiple sessions can occur on the same day. The founding session happens to be the only one on 2026-03-08, but this will not hold.

### Recommended Convention
Slug format: `session-prompts-<date>-<uuid-prefix8>`
Example: `session-prompts-2026-03-08-3b054304`

This is:
- Human-readable (date + short UUID prefix)
- Unique (UUID prefix disambiguates same-day sessions)
- Cross-referenceable (full UUID stored in frontmatter)

### Frontmatter Addition
Session-prompts entries should include a `session_id` frontmatter field:
```yaml
session_id: 3b054304-acad-4830-b766-0d18cf655d63
```

This enables cross-referencing back to the source JSONL without relying on the slug alone.

### On Setting Session Names
There is no native Claude Code API to set a session name that persists in the JSONL. If a human-readable name is desired, it must be:
1. Set by convention in the knowledge entry frontmatter (a `session_name` field)
2. Either assigned by the agent at session start, or by the user at any point

The agent CAN write this field to the entry — it is not exclusively a human action. A session-start routine could prompt for or auto-generate a session name and store it immediately.

### Action Item
The founding session entry (`session-prompts-2026-03-08`) should be migrated to `session-prompts-2026-03-08-3b054304` with `session_id` frontmatter added. Low priority — founding session is unambiguous.
