---
id: 19
title: Verification Routine — Lossless Security Check
tags: [security, verification, lossless, tool-call, routine]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

A script-based routine that verifies no knowledge has been lost. Checks structural integrity of all entries (frontmatter valid, two-layer format present, index current) and reports gaps. This is the first-class security system for the lossless design intent. Must be run at minimum at the end of every session during Phase 1 development.

## Layer 2 — Full Detail

### What it checks

1. **Frontmatter validity**: every entry has id, title, tags, namespace, created, updated
2. **Two-layer format**: every entry has both `## Layer 1` and `## Layer 2` sections
3. **Index currency**: every entry file has a corresponding row in index.md (if index is still maintained)
4. **No orphans**: no rows in index.md pointing to non-existent files
5. **No duplicate IDs**: all `id` fields are unique across entries
6. **Bootstrap coverage**: bootstrap.js extracts a Layer 1 from every entry (none silently skipped)

### When to run

- At the end of every session during Phase 1 development (mandatory)
- After any batch write operation
- Before switching sessions or handing off to a new agent

### Co-mandatory: semantic purification

Verify (structural integrity) and purify --semantic (knowledge completeness) are co-mandatory at session end. Verify checks the entries are well-formed. Purify checks the entries are complete relative to what was decided. Neither alone is sufficient for the lossless guarantee.

Stop hook sequence: verify → purify → update-status.

### Output

Reports pass/fail per check. On failure, lists specific entries and what is missing. Exit code 0 = all clear, exit code 1 = gaps found.

### Security framing

This routine is the enforcement mechanism for the lossless design intent. A session that ends without running verification has an unknown loss state. The routine makes loss visible — it does not prevent it, but it ensures it cannot be silent.

See tool-call entry: `tool-call-verify` (to be created).
