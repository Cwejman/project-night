---
id: 03
title: Markdown Phase — Structure and Rules
tags: [markdown, structure, rules, phase-1]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The markdown phase is the current storage layer — human-readable, explicitly not the final system. Its rules (one concept per file, two-layer L1/L2 format, master index) apply to the existing `knowledge/entries/` system. However, whether the next phase continues in this format is under active exploration. The bite model (weighted chunks without L1/L2 — see `multi-layer-embedding`) and questions about what the knowledge system's information units actually are have opened up the possibility that the markdown structure changes significantly or is bypassed. These rules describe what IS, not necessarily what's next.

## Layer 2 — Full Detail

> **Context (2026-03-15):** The rules and format below describe the current working system (`knowledge/entries/`). Whether the next phase uses this same format is under active exploration — see `multi-layer-embedding` (bite model), `deliberate-phase-buildup` (format reconsideration). These rules apply to the existing system; they are not assumed to carry forward.

Phase 1 of the knowledge system uses markdown files as the storage layer.

## Directory layout

```
/Users/jcwejman/git/@x/night/
└── knowledge/
    ├── index.md          ← master index, all entries listed with one-line summaries
    └── entries/
        └── <slug>.md     ← one entry per concept/topic
```

## Entry format

```markdown
---
id: <sequential or uuid>
title: <human title>
tags: [tag1, tag2]
namespace: <domain>
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

Content here — free-form, one clear idea per file.
```

## Entry structure — two-layer format (required)

All entries use a two-layer structure:

```markdown
## Layer 1 — Summary
Concise paragraph. Optimized for semantic embedding. Captures the essence.

## Layer 2 — Full Detail
Unconstrained. Full content, scripts, data, observations. Does not affect top-layer retrieval.
```

Large content (scripts, tool calls, raw data) belongs in Layer 2. Layer 1 must stay concise regardless of Layer 2 size.

## Rules
- One concept per file
- Two-layer format required (Layer 1 summary + Layer 2 full detail)
- Always update `knowledge/index.md` after adding or changing an entry
- MEMORY.md is pointer-only — no knowledge goes there, ever
- Index must be consulted before adding entries to avoid duplicates
- All tool call scripts use Node.js (permanent rule — see tool-call-storage.md)
