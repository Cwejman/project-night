---
id: 09
title: Tool Call Storage — Script Knowledge as First-Class Entries
tags: [tool-calls, scripts, storage, node, convention]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Script-based tool calls are stored in the knowledge system as first-class entries using the same markdown format. Layer 1 describes what the tool does; Layer 2 holds the full implementation. All tool call scripts use Node.js — this is a permanent rule.

## Layer 2 — Full Detail

### Tool calls as knowledge entries

Tool calls (scripts executed as part of Claude's workflow) are knowledge artifacts, not ephemeral code. They are stored in `knowledge/entries/` using the standard entry format:

```markdown
---
id: <id>
title: <what the tool does>
tags: [tool-call, <domain>]
namespace: <namespace>
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

## Layer 1 — Summary
What the tool does, when to invoke it, what it returns.

## Layer 2 — Implementation
\`\`\`js
// full Node.js script
\`\`\`
```

### Node.js — permanent rule

All tool call scripts are written in Node.js. This is a hardcoded rule, not a preference.

Rationale: Node is already present in the environment (observed in use during session), consistent with the TypeScript MCP server choice, and avoids interpreter fragmentation across tool calls.

Future: when a global config exists for the system, `runtime: node` should be an explicit config value. Until then, treat it as a hard rule.

### Storage location

Tool call entries live alongside all other knowledge entries under `knowledge/entries/`. No separate directory. The `tool-call` tag and the Layer 2 implementation block distinguish them structurally.
