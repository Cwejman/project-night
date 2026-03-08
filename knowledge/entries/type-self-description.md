---
id: 14
title: Types Are Self-Describing — No Dedicated Type Files Needed
tags: [architecture, type-system, embedding, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Types do not need dedicated first-class `.md` files. The tag on an entry combined with its Layer 1 embedding IS the type definition — self-describing and discoverable through semantic search. A `message` entry defines what a message is by existing as one.

## Layer 2 — Full Detail

### The observation

One might expect a typed system to have explicit type definition entries: `type-message.md`, `type-tool-call.md`, etc. But these are unnecessary because:

- The tag (`message`, `tool-call`, `prompt`) is the type identifier
- The Layer 1 summary of each entry describes what that type of content is
- Semantic search over Layer 1 summaries with a type tag filter is equivalent to querying a type registry

The type system emerges from the corpus, not from a separate schema file.

### Why this is correct for an embedding system

In a vector DB, types are filter conditions, not schema declarations. You do not need a `message` collection or a `message` type document — you need entries that have `message` as a tag and a Layer 1 that accurately describes their content. The embedding of Layer 1 across all `message`-tagged entries creates an implicit type cluster in the vector space.

A dedicated `type: message.md` entry would be redundant — it would describe what message entries already demonstrate by their existence.

### When a type entry IS warranted

If a type requires non-obvious rules — e.g. the specific Layer 2 format for a `message` entry, or constraints on what a `tool-call` entry must include — that belongs in a convention entry (like `tool-call-storage.md` or `deep-layer-data-types.md`), not a type definition file. Convention entries are about rules; type identity emerges from the corpus.
