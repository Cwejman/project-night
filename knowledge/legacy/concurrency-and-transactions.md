---
id: 17
title: Concurrency, Transactions, and the Single-Writer Property
tags: [architecture, concurrency, transactions, permissions, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The current FS-based system has no transactions and no locking. Subagents cannot write (permission boundary). This makes the primary agent the only writer — which is an accidental but valid form of serialization. In Phase 2, the MCP server becomes the single write path, making transaction semantics explicit and intentional.

## Layer 2 — Full Detail

### The problem

Markdown files on disk have no atomic write guarantees, no locking, and no conflict detection. Concurrent writes to `index.md` or any entry from multiple agents would produce corruption or lost updates.

### The accidental solution (Phase 1)

The permission boundary — subagents cannot write files — enforces a single-writer constraint by accident. Only the primary agent can write. This eliminates the concurrent write problem without any explicit locking mechanism. It is not elegant, but it is safe.

### What this means for reads

Reads have no transaction semantics either — an agent reading an entry while another writes it could see a partial state. In Phase 1, this is accepted: reads are from the primary agent or subagents (read-only), and the primary agent writes sequentially, not concurrently. The risk is low.

### Phase 2: MCP server as the explicit write path

The MCP server becomes the single write path for all agents. All writes go through the server's API (store, update, delete tools). This:
- Serializes writes at the server level
- Enables optimistic locking or versioning if needed
- Makes the single-writer property explicit and intentional, not accidental

The server can also implement atomic operations: embed + store in one transaction, preventing partial states where a file exists but no vector exists for it.

### The interesting parallel

JS files and markdown files in this system both carry frontmatter. Both are structured knowledge artifacts. The same read/write constraints apply to both. This is not a coincidence — it reflects the design principle that tool calls are knowledge, stored the same way as prose.

### Open question: generate-index ownership in parallel sessions

When two sessions run concurrently, `generate-index.js` (full file rewrite) is the most dangerous shared operation. One proposed mitigation: designate one session as index owner. This is NOT yet decided — the approach is noted but the right answer may be different (e.g. lock files, MCP server as single writer, or tolerating brief index divergence). Do not implement until evaluated further.

### Open question: MCP concurrency model

Should the MCP server implement optimistic concurrency (version fields, CAS operations)? Or is single-writer-by-design sufficient given the system's intended use (one human, one primary agent)?
