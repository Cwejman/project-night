---
id: 03
title: Markdown Phase — Structure and Rules
tags: [markdown, structure, rules, phase-1]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Phase 1 uses markdown files as the storage layer. One concept per file, standardized frontmatter, two-layer entry format (concise summary + full detail), master index always kept current. Entries are seed data for Phase 2 vector ingestion. All tool call scripts use Node.js.

## Layer 2 — Full Detail

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
