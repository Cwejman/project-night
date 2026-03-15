---
id: intelligent-garbage-collection
title: Intelligent Garbage Collection — Future Scaling Capability
tags: [architecture, future, storage, lossless, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

When storage size becomes a constraint, intelligent garbage collection will be needed — but it must preserve the lossless property. GC cannot simply delete old entries; it must identify what is truly superseded, redundant, or derivable from other entries. Not in scope now. The lossless design intent is the governing constraint any future GC implementation must satisfy.

## Layer 2

### The tension

Lossless design means nothing is lost. Unbounded storage means the knowledge base grows indefinitely. At some scale these conflict. The resolution is intelligent GC: not deletion of old data, but semantic compression — identifying entries whose knowledge is fully subsumed by newer, richer entries, and archiving or merging them rather than deleting.

### What intelligent means

Dumb GC deletes by age or size. Intelligent GC:
- Identifies entries that are fully derivable from other entries (semantic redundancy)
- Detects entries superseded by newer decisions (e.g. an old architecture decision overridden by a later one)
- Merges fragmented related entries into richer single entries
- Archives rather than deletes — preserving the option to restore

### Not in scope

This is a future capability triggered by actual storage pressure. Phase 1 and Phase 2 operate under the assumption of abundant storage. When the constraint appears, the GC design should be driven by the actual pattern of redundancy observed in the knowledge base at that point.

### Governing constraint

Any GC implementation must satisfy the lossless design intent. If a piece of knowledge cannot be recovered after GC runs, the GC was wrong.

### Weighting down vs. archiving

A more precise mechanic than archiving: when newer knowledge supersedes older, the older chunk is weighted down — still present, still recoverable on direct query, but no longer default-retrieved. It doesn't pollute current context. This is closer to how vector retrieval works naturally (proximity score determines inclusion) than archival deletion is.

### Is human oversight always required?

The assumption that purification requires human approval may be too conservative. If the system is rightly constructed — reverse prompting verifies that what supersedes an entry genuinely contains the older entry's intent — then weighting down can potentially happen autonomously, not arbitrarily. The validation mechanism (reverse prompting → similarity score) provides the ground for a non-human decision. This is open; it depends on how reliably that check can be trusted at scale. See `reverse-prompting` for the validation mechanic.

Whether this purification runs as part of the agent's regular breath, or requires a separate caretaker agent with its own cycle, is also open — and may not be solvable in the FS-based phase at all due to the absence of transactions.
