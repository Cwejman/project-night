---
id: code-knowledge-relationship
title: Code-Knowledge Relationship — References Not Copies
tags: [architecture, code, knowledge, tool-calls, design]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-12
---

## Layer 1

Tool call entries currently hold a copy of the implementation code in their L2 layer, while the actual `.js` file lives in `.claude/hooks/`. This dual-source-of-truth will drift. The knowledge system's job is semantic indexing — making code discoverable by meaning — not code storage. L2 should reference the code file rather than duplicate it. The entry provides the semantic handle; the code lives where code lives. At query time (Phase 2), the MCP server follows the reference and returns current file contents. This also clarifies the broader question: if the system IS the agent, then code and knowledge aren't parallel tracks — they're different expressions of the same capability. An entry about bootstrap and the bootstrap script are two views of one thing.

## Layer 2

### Current state

Tool call entries (e.g., `tool-call-bootstrap.md`) have:
- **L1:** description of what the tool does
- **L2:** full implementation code (copy of the `.js` file)

The actual scripts live in `.claude/hooks/` or `.claude/`. Two locations for the same content.

### The problem

If someone edits the `.js` file, the `.md` L2 is stale. If someone edits the `.md`, the `.js` doesn't change. This is the classic dual-source-of-truth antipattern. It hasn't caused problems yet because changes are infrequent, but it will.

### The solution

L2 references the code rather than embedding it:

```markdown
## Layer 2 — Full Detail
**Implementation:** `.claude/hooks/bootstrap.js`
[Description of design decisions, edge cases, constraints — the WHY, not the WHAT]
```

The `.md` entry is the semantic handle. The `.js` file is the implementation. L2 adds value by explaining design rationale and constraints that aren't obvious from the code alone — not by duplicating the code.

### Connection to system-as-agent identity

If the knowledge system IS the agent, then code is a capability artifact of the system — not a separate thing that needs documenting. The entry says "this capability exists and here's what it means." The code file says "here's how it's implemented." Both are first-class. Neither is primary.

This also means the `.md` entry's L1 summary (which goes into bootstrap context) is genuinely valuable: it tells the agent "you have this capability" without loading the implementation. The agent queries the code (via file read or MCP) only when it needs the implementation details.

### Migration path

Not urgent. The current duplicated state works during Phase 1. When tool call entries are next edited, update L2 to reference rather than embed. No mass migration needed — natural evolution as entries are touched.
