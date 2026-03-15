---
id: monorepo-architecture
title: Monorepo Architecture — Culture, Claude, and Lore as Peers
tags: [architecture, monorepo, culture, integration, muscles, knowledge, design]
namespace: knowledge-system
created: 2026-03-13
updated: 2026-03-13
---

## Layer 1

One explored structure for the system: a monorepo with three peer directories — `culture/` (platform-agnostic cognitive patterns), `claude/` (Claude-specific muscles and hooks as a plugin), and `lore/` (evolutionary depth). This was designed before the current exploration of what the knowledge system's information model actually is (see `multi-layer-embedding` — bite model, `deliberate-phase-buildup` — format reconsideration). The directory structure described here assumes one-concept-per-file markdown with L1/L2 layers — an assumption now under active questioning. The structure may change significantly depending on what the exploration concludes about the right information units, weighting, and breath process. The platform-agnostic culture principle and the plugin integration approach remain valid independent of format.

## Layer 2

> **Context (2026-03-15):** This architecture was designed assuming one-concept-per-file markdown with L1/L2 layers. That assumption is now under active questioning — the bite model (weighted chunks, no L1/L2), dynamic cognitive layers, and questions about what the knowledge system's information units actually are may change this structure significantly. The principles below (platform agnosticism, culture/code separation, plugin mechanism) remain valid independent of format. The specific directory layout, build sequence, and bootstrap behavior are tied to the markdown format and may not survive the exploration. Read as one explored design, not the settled plan.

### Structure

```
{name}/
├── culture/
│   └── entries/        ← platform-agnostic: cognitive patterns, lossless rules,
│                          operational conventions, how the knowledge structure works.
│                          No Claude, no hooks, no code. Any LLM on any platform
│                          can load these and know how to operate.
│
├── claude/                      ← THIS IS A CLAUDE CODE PLUGIN
│   ├── .claude-plugin/
│   │   └── plugin.json          ← manifest: name, version, author
│   ├── hooks/
│   │   ├── hooks.json           ← hook event config (not ~/.claude/settings.json)
│   │   ├── bootstrap.js         ← muscle: reads culture + claude L1 → injects context
│   │   ├── verify.js            ← muscle: structural integrity check
│   │   └── ...                  ← other muscles as .js files
│   ├── entries/                 ← Claude-specific knowledge entries
│   │                               Each muscle has a corresponding entry:
│   │                               L1 = what it does, when it runs, what it enforces
│   │                               L2 = full code (for completeness, not the source)
│   └── skills/                  ← any exposed skills (namespaced: /{name}:skill)
│
└── lore/
    └── entries/        ← sessions, roadmap, architecture history, parse experiments,
                           naming/meaning explorations. The evolutionary depth.
                           Consulted when the system itself evolves.
```

### The muscles-knowledge marriage

Muscles live as `.js` files in `claude/hooks/`. Each muscle has a corresponding entry in `claude/entries/` — L1 describes what it does and when it runs, L2 contains the full code for completeness and on-demand reading. The entry provides the semantic handle; the `.js` file is the invocable artifact. They are two views of one capability.

The behavioral CONTRACT belongs in `culture/` — what must be enforced and why. The Claude-specific INVOCATION belongs in `claude/entries/` — which hook event, what exit codes, what Claude-specific behavior. `claude/` entries are thin: they describe "in Claude Code, this culture rule is enforced by X hook."

### The plugin mechanism

`claude/` is a standard Claude Code plugin (requires version 1.0.33+). No `install.js`, no `~/.claude/settings.json` manipulation:

- Install: `/plugin install ./{name}/claude` at user scope → fires in every session
- Hooks are declared in `claude/hooks/hooks.json` — the plugin owns its hooks
- Skills namespaced as `/{name}:skill-name`
- `--plugin-dir` for local development testing

This is Claude Code's first-class extension mechanism, not a workaround. Hooks, skills, MCP servers, and agents can all ship in one plugin package.

### Bootstrap behavior

When a Claude session starts, the SessionStart hook fires (installed by `install.js`, pointing into `claude/`). Bootstrap reads:
- `culture/entries/` — all L1 summaries → into context
- `claude/entries/` — all L1 summaries → into context (muscle descriptions included, code stays in L2)

L2 content is never pushed into bootstrap context. It is available on demand when the agent needs to read, reason about, or modify a muscle. This keeps bootstrap token footprint small regardless of how large the implementations grow.

### Platform agnosticism

`culture/` has no platform-specific content. A `gemini/` or `openai/` peer would contain its own entries and muscles — different L2 implementations, same cognitive architecture. Culture entries are loaded unchanged regardless of which platform peer is active. The genome is shared; the cellular machinery differs per platform.

### Other projects

An emacs config project, a work codebase, any directory — by default gets:
- `claude/` integration (hooks fire globally, written by `install.js`)
- `culture/` bootstrap (L1 summaries injected at session start)
- Its own local knowledge, built from scratch in that directory

It does NOT get `lore/` by default. Core evolutionary depth is not pushed to other projects. Cross-project knowledge sharing is opt-in peer connectivity, not default.

### Current state vs this architecture

Currently everything lives in `@x/night`: scripts in `.claude/`, entries in `knowledge/entries/`. The existing system stays untouched and working throughout — it is NOT migrated into the new structure.

`culture/` and `claude/` are built from scratch:
- `culture/` — designed and written in a dedicated session. New entries written fresh for platform-agnostic cognitive patterns. Existing entries inform what goes there but are not copied.
- `claude/` — built as a clean plugin. New `.js` muscles (not ported from the existing poor hooks), new `claude/entries/`, new `plugin.json` + `hooks.json`.

The existing `knowledge/entries/` becomes `lore/` eventually — a rename/restructure deferred until the new structure is proven. The existing `.claude/` hooks stay in place until the new plugin replaces them.

Build sequence:
1. Culture session — design and write culture entries from scratch
2. Claude plugin session — build the plugin clean (muscles, entries, plugin.json, hooks.json)
3. Existing → lore — rename/restructure when the new system is ready
4. `@x/night` IS the monorepo — no new repository needed

