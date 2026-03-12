---
id: evolution-synthesis-2026-03-12
title: Evolution Synthesis — System Architecture as of 2026-03-12
tags: [synthesis, architecture, evolution, design, system-state]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-12
---

## Layer 1

The system decomposes into five concerns that must not be conflated: (1) the knowledge system — stores and serves, IS the agent's identity; (2) code muscles — deterministic enforcement of rules the completion model can't be trusted to remember; (3) projects — peers with opt-in connectivity, bare files by default; (4) connectivity — MCP as integration protocol, peer-to-peer, not hierarchical; (5) platform integration — thin per-runtime binding (Claude Code hooks, TUI), solves cold-start, enforces compliance when needed. Evolution follows simplicity: each capability is earned by actual need, not assumed upfront.

## Layer 2

### The Five Concerns

#### 1. Knowledge System (identity)

The knowledge system is not a tool the agent uses — it IS the agent. The LLM is the reasoning engine; the knowledge system provides identity, capability, and cognition. Entries that describe cognitive patterns, design rules, and tool capabilities are not documentation — they program the agent's behavior. Load them into a different LLM and you get a version of the same agent.

This means:
- There is no meaningful "core system" vs "Claude-specific" separation
- The system instantiates an agent on top of any LLM
- Project separation is real; system-vs-agent separation is false

Storage is an implementation detail. Files now, vector DB later. The knowledge system is defined by its content and structure, not its storage.

#### 2. Code Muscles (enforcement)

The completion model forgets rules. Code doesn't. Every convention documented as a knowledge entry but not enforced by code is a reliability gap. The session-prompt naming convention was documented but violated — a pre-write validation hook would have prevented this.

The relationship between code and knowledge:
- Knowledge entries define what the rules ARE (semantic, queryable, meaningful)
- Code enforces them (deterministic, runs every time)
- They are two views of one capability — not parallel tracks to sync
- Entries should reference code, not duplicate it (L2 points to implementation file)

Evolution path: Node.js scripts → MCP server with embedded validation routines. The MCP server becomes the system's musculature — not just a query interface but an integrity guardian.

#### 3. Projects (silos)

Projects are peers of the core system, not children in a hierarchy. The architecture is flat: each node decides its own connectivity.

**Default: simplicity.** A new project is bare `.md` files in a directory. No MCP, no server, no infrastructure. This is sufficient for most personal projects.

**Opt-in escalation:** When a project needs core capability, it connects to core MCP. When it needs cross-project access, it opens a peer connection. When it needs compliance isolation, the interface layer enforces boundaries. Each step earned by need.

**Privacy by default.** A silo's knowledge stays in its directory. No sharing unless explicitly chosen. Secrets, domain decisions, project-specific patterns — all local.

**Core evolution is human-controlled.** The user works in seven tmux sessions. Going to the core project to evolve it is natural workflow. Silos don't write back to core automatically — the human is the channel between projects.

#### 4. Connectivity (MCP as protocol)

MCP is the integration boundary — how the system presents itself to any agent on any platform. But it is not the sole access boundary.

**Hybrid access:**
- Core knowledge → MCP (universal, storage-abstracted)
- Silo knowledge → local files (simple, private, direct)
- Both are valid, complementary access patterns

**Peer-to-peer:** Projects connect to each other via MCP when needed. Not hierarchical. Core is a peer that happens to serve shared capability. One project can open itself to another — opt-in, not default.

**The knowledge system is policy-neutral.** It provides the capability to connect or isolate. It has no opinion on who should access what. That's the interface layer's job.

#### 5. Platform Integration (initially part of core)

Platform integration (Claude Code hooks, TUI, bootstrap routines) is deeply coupled with core at this stage. Separating them early creates artificial distance without benefit. They start as one body with the acknowledgment that as the system supports multiple platforms, separation may become valuable. Embedding is about excluding what's unnecessary — if integration knowledge is always needed alongside core, they belong together until proven otherwise.

For compliance-sensitive deployments: a custom interface could enforce hard boundaries between silos. This is an access control concern layered above the system, not within it.

---

### Evolution Gradient

```
Current state (Phase 1)
├── Single project, files only
├── Rules documented as entries but enforced by convention
├── Scripts as standalone Node.js files
├── Claude Code hooks for bootstrap/TUI
└── No multi-project support

Next evolution
├── Code muscles strengthen (validation routines, pre-write checks)
├── MCP server for core (makes identity available to any project)
├── First silo: any new directory with Claude launched — already a project
├── Code-knowledge references (entries point to code, not duplicate)
└── Core and integration remain unified, separation acknowledged as future option

Further out
├── Vector DB behind MCP (storage upgrade, invisible to agents)
├── Direction toward atomic, versioned semantic mutations — form not yet settled
├── Multiple silos with varying connectivity levels
├── Compliance-aware interface layer for sensitive projects
└── System defines agents completely enough to be LLM-interchangeable
```

### Governing Principles

1. **Simplicity drives evolution** — each capability earned by actual need, not assumed
2. **Code enforces, knowledge describes** — the completion model is fallible; code is deterministic
3. **Peers, not hierarchy** — flat connectivity, opt-in sharing, no inheritance semantics
4. **The system IS the agent** — not augmentation, not tooling — identity
5. **Compliance is an interface concern** — the knowledge system is policy-neutral
6. **Human steers** — core evolution is human-controlled, the system supports
7. **The system builds itself** — it contains knowledge about what to become, and uses that knowledge to guide its own development. The POC proves concepts the final system inherits.
8. **Big picture is never lost** — part of the lossless nature and the core values. Current grounding in files and directories is deliberate. The clues toward what comes next are embedded throughout the system — those connected to the vision will recognize them.
