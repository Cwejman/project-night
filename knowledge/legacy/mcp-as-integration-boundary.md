---
id: mcp-as-integration-boundary
title: MCP as Integration Boundary — Not Sole Gateway
tags: [architecture, mcp, design, hybrid-access, model-agnostic]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-12
---

## Layer 1

MCP is the integration boundary — how the system presents itself to any agent on any platform — but not necessarily the sole access boundary. The hybrid model: MCP for core/shared knowledge (universal, abstracted from storage), local files for silo knowledge (simple, private, direct). This avoids forcing every small project to run a server while still providing model-agnostic access to core capability. The platform integration layer (Claude Code hooks, TUI, statusline) remains thin and per-runtime — it solves cold-start/bootstrap, not knowledge access. The human always has direct access to storage regardless of the agent interface.

## Layer 2

### MCP's role — clearly defined

MCP is:
- The universal agent interface to the knowledge system
- Storage-agnostic (files, Qdrant, anything behind it)
- The way core system knowledge is served to any project
- Model-agnostic (any MCP-speaking agent gets access)
- Where semantic search operates
- Where cross-project/cross-silo access is mediated with permissions

MCP is NOT:
- The only way knowledge can be accessed
- Required for local/silo knowledge reads
- A replacement for direct file access in all cases

### The hybrid access pattern

**Core knowledge → MCP** (served to any agent, any project, storage-abstracted)
**Silo knowledge → local files** (read directly by the agent working in that directory)

This gives:
- Zero infrastructure for small silos (just `.md` files in the project directory)
- Full model-agnosticism for core (MCP)
- Privacy by default for silos (no server exposure)
- Option to register a silo with MCP when it outgrows files

### Concerns examined

**Search completeness:** Semantic search only covers MCP-indexed knowledge. Local file knowledge requires direct reads. Bounded and intentional — MCP covers shared, files cover local. The agent knows it has both sources.

**Bootstrap (cold-start):** If MCP serves core, the agent needs to know about MCP at session start. This is the platform integration layer's job — a thin hook that says "you have a knowledge MCP server" and optionally injects L1 summaries. Not a violation of MCP-as-boundary; it's the runtime binding doing its work.

**Browsability:** Direct file reads have an exploratory quality — stumbling on adjacent entries, scanning directories. MCP is query-driven. A well-designed MCP server can offer exploration tools ("entries related to X", "what's adjacent"). But files naturally support browsing. The hybrid preserves this for silo knowledge.

**Resilience:** If MCP is down, local file knowledge still works. Bootstrap hook can fall back to file reads. The hybrid is inherently more resilient than MCP-only.

### Architecture diagram

```
Knowledge System (MCP server — core integration boundary)
  ├── Storage (files now, Qdrant later — invisible to agents)
  ├── Capability (search, store, update, verify, purify)
  └── Scoping (core, registered silos — with permissions)

Silo Knowledge (local files — per-project)
  ├── .md entries in project directory
  ├── Read directly by agent
  └── Optionally registered with MCP

Platform Integration (thin, per-runtime)
  ├── Claude Code: bootstrap hook, TUI, statusline
  ├── Other agents: their own integration
  └── Purpose: cold-start, UX conveniences — NOT knowledge storage
```
