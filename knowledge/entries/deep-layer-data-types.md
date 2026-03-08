---
id: 12
title: Deep Layer Data Types — Tags as the Type System
tags: [architecture, embedding, data-types, messages, prompts, type-system]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Tags are the type system. In a typed embedding system, tags like `message`, `prompt`, `tool-call`, `script` serve as the data type of an entry — determining how it is embedded, how it is filtered, and how its layers are structured. Any data type can live in the deep layer with minimal top-layer representation to avoid bloat.

## Layer 2 — Full Detail

### Tags as types

In the current FS-based system, tags are frontmatter metadata. In the vector DB phase, they become the primary type discriminator — the equivalent of a typed collection or namespace filter. When querying, you first filter by type tag, then apply semantic search within that type.

This means tag choice is architectural, not cosmetic.

| Tag | Data type | Top layer | Deep layer |
|-----|-----------|-----------|------------|
| `tool-call`, `script` | Executable script | What it does, when to use | Full Node.js implementation |
| `message`, `prompt` | Human chat prompt | Minimal — topic only, or omitted | Verbatim prompt text |
| `vision`, `design` | Conceptual entry | Full summary | Extended reasoning |
| `parse`, `synthesis` | Agent-authored analysis | Summary of findings | Full observations |
| `data`, `config` | Structured data | What it configures | Full JSON/config block |

### Human prompts as typed entries

Human prompts from chat are stored with type tags `message` and `prompt`. Top layer is minimal — just enough to tag the topic — to avoid polluting the semantic index with raw natural language. Full prompt text lives in Layer 2.

This gives the system a retrievable record of human intent and vocabulary over time, without bloating top-layer embeddings.

### Entry format for typed message entries

```markdown
---
id: <id>
title: <topic or intent label>
tags: [message, prompt, <topic>]
namespace: <namespace>
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

## Layer 1 — Summary
<one line: what this prompt is about — or omit if pure storage>

## Layer 2 — Raw
<verbatim prompt or message text>
```

### Why the two-layer model enables this

Large artifacts (raw prompts, full scripts) live in Layer 2 and contribute zero tokens to the top-layer embedding. The type tag filters entries before semantic search runs. This combination — type filtering + Layer 1 semantic match + Layer 2 full retrieval — is the core retrieval pattern for the vector DB phase.
