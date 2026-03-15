---
id: 02
title: Tech Stack Decisions
tags: [tech, architecture, decisions]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Tech stack settled in priority order: Qdrant (local, no infra), Anthropic embeddings (no extra token initially), TypeScript MCP server. Chunking TBD. Metadata schema: id, title, tags, namespace, created, updated. voyage-3 flagged for future evaluation.

## Layer 2 — Full Detail

Decisions settled in priority order:

| Decision | Choice | Rationale |
|---|---|---|
| Vector DB | Qdrant (local mode) | No infra needed, fast, production-grade |
| Embeddings | Anthropic | Already available, no extra API token required initially |
| Language | TypeScript | MCP SDK available, consistent ecosystem |
| Chunking | TBD | Fixed size / sentence / semantic — to decide at build time |
| Metadata schema | id, title, tags, namespace, created, updated | Supports filtering, future migration, deduplication |

## Notes
- Anthropic embeddings: API-token-free path is TBD — system should be designed to support this
- voyage-3 (Anthropic-recommended embedding model): noted for future exploration once vector DB phase begins
