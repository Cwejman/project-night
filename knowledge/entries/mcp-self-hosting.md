---
id: 23
title: MCP Self-Hosting — The Server Is Its Own Knowledge
tags: [mcp, architecture, self-hosting, introspectability, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The MCP server's own implementation is stored as knowledge entries within the system it serves. Every tool (store, search, update, delete) is a tool-call entry with a Layer 1 description and a Layer 2 implementation. The MCP is queryable through itself — fully introspectable with no loss. No code lives outside the system.

## Layer 2 — Full Detail

### The principle

A standard MCP server is a black box: its implementation lives in source files outside any knowledge system, readable only by reading those files directly. This violates the lossless and introspectability goals.

Instead: every component of the MCP server is a knowledge entry. The TypeScript/Node.js implementation of each tool is the Layer 2 of its entry. Layer 1 describes what it does. The system can answer "how does the search tool work?" by returning the `mcp-tool-search` entry — no file read required, no context bloat.

### What this enables

- **Token efficiency**: agents query the knowledge system to understand the MCP, not read source files
- **Introspectability**: the MCP's inner workings are queryable at the same semantic layer as all other knowledge
- **No outside code**: the entire system — including the system that runs it — is contained within the knowledge system
- **Self-documentation**: the MCP cannot drift from its documentation because the documentation IS the implementation
- **Recursive coherence**: the system that provides memory is itself remembered by the system

### What entries the MCP generates

Each of the following becomes a knowledge entry tagged `[mcp, tool-call]`:

| Entry slug | What it is |
|---|---|
| `mcp-server` | Server bootstrap, transport config, entry point |
| `mcp-tool-store` | store(content, metadata) — embed + write |
| `mcp-tool-search` | search(query, filters, k) — embed query + nearest neighbor |
| `mcp-tool-get` | get(id) — retrieve by ID |
| `mcp-tool-update` | update(id, content, metadata) — re-embed + overwrite |
| `mcp-tool-delete` | delete(id) — remove from vector store |
| `mcp-tool-list` | list(filters) — enumerate entries by metadata |
| `mcp-config` | Qdrant connection, embedding model, namespace defaults |

### Implication for Phase 2 build

The MCP is not built outside the knowledge system and then documented inside it. It is built inside the knowledge system from the start — entries first, then assembled into a running server. The knowledge system is the single source of truth for both the MCP's behavior and its implementation.

### Relationship to token efficiency

In Phase 1, agents read files to understand the knowledge base — expensive in tokens. In Phase 2, agents call `search(query)` or `get(id)` and receive exactly the relevant content. The MCP being self-hosted means agents can also understand the MCP itself through the same cheap tool calls, not through expensive file reads.
