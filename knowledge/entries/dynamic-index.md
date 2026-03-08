---
id: 18
title: Dynamic Index — index.md as Generated Artifact
tags: [architecture, index, tool-call, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The static `index.md` is redundant if a script can generate it dynamically from entry frontmatter and Layer 1 summaries. In Phase 1, it remains as a human-readable convenience and integrity checkpoint. In Phase 2, the vector DB index is the authoritative index — no file needed. The script-generated index is always accurate; the static file can drift.

## Layer 2 — Full Detail

### The redundancy argument

`index.md` is currently maintained manually — a brittle dependency flagged in the parse experiment. Every entry addition requires a separate index update. A script that reads all frontmatters and Layer 1 summaries can generate the same index on demand, always accurate, zero maintenance cost.

### What to do with index.md

Two valid approaches:
1. **Keep as generated artifact**: run `generate-index.js` to regenerate `index.md` after any entry change. Humans can read it; it is never edited manually.
2. **Eliminate entirely**: remove `index.md`, replace all usages with the script. Bootstrap and verification scripts query frontmatter directly.

Recommended: treat `index.md` as a generated artifact in Phase 1. Eliminate in Phase 2 when the vector DB provides its own index.

### Rule update

Manual index maintenance (`always update index.md after adding entries`) is deprecated in favor of the generate-index script. The script should be run after any write operation.

See tool-call entry: `tool-call-generate-index` (to be created).
