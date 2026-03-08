---
id: 04
title: Roadmap — Phases
tags: [roadmap, phases, planning]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Two phases: Phase 1 (current) — markdown files, manual query, seed data; Phase 2 — Qdrant local + TypeScript MCP server + Anthropic embeddings. Open questions: chunking strategy, API-token-free embedding path. Phase 1 entries migrate wholesale as Phase 2 seed data.

## Layer 2 — Full Detail

## Phase 1 — Markdown (current)
Storage: markdown files under `knowledge/entries/`
Query: manual / grep / Claude reading files directly
Goal: establish structure and populate knowledge before vector infra exists

## Phase 2 — Qdrant + MCP
Storage: Qdrant local instance
Interface: MCP server exposing tools (store, search, update, delete)
Embeddings: Anthropic (voyage-3 candidate — evaluate at build time)
Migration: Phase 1 entries are seed data for Phase 2 ingestion

## Open questions for Phase 2
- API-token-free embedding path with Anthropic
- Chunking strategy (fixed / sentence / semantic)
- MCP server language: TypeScript
