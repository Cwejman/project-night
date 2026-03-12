---
id: multi-project-architecture
title: Multi-Project Architecture — Silos, Core, and Boundaries
tags: [architecture, projects, silos, compliance, privacy, mcp, design]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-12
---

## Layer 1

Projects are peers of the core system, not children in a hierarchy. Each peer node chooses what it shares — connectivity is opt-in, not default. The architecture enables both full openness (personal project with no compliance needs connects freely to core) and hard isolation (compliance-sensitive project shares nothing). The knowledge system itself has no opinion on access control — it provides the capability to connect or isolate. Hard compliance boundaries belong to the interface layer (Claude Code, a custom agent shell), not to the knowledge system. Three distinct concerns: (1) the knowledge system stores and serves; (2) connectivity is peer-to-peer and opt-in; (3) access control is enforced by the interface, not the system.

## Layer 2

### The triggering requirement

Using the knowledge system with multiple projects (e.g., emacs config, separate codebases) without copying and remerging the knowledge base. Copy-and-remerge violates data control and creates drift.

### Silo properties

A silo (project) needs:
- **Privacy** — its knowledge stays bounded, can contain secrets
- **Isolation** — one project's decisions never pollute another
- **Core access** — the agent's identity and capability are available
- **Core evolution** — insights from silo work can improve core (controlled mechanism)
- **Zero infrastructure for small projects** — not every silo needs a server

### Peer model — settled

Projects are peers, not children. The core system is another peer that happens to serve shared capability via MCP. No hierarchy, no inheritance, no cascading. Each node decides its own connectivity.

**Default posture: simplicity.** The base case is a project with local `.md` files and nothing else — no MCP, no server, no infrastructure. MCP connection to core, symlink-based FS access, vector DB access — all opt-in when a project needs them. Not having MCP in the first place is a good start for most projects. Even when MCP exists, it can be built to enforce compliance internally. Simplicity is key for strong evolution — evolve where most required first.

**Compliance as interface concern.** For projects that require hard boundaries, isolation is enforced by the interface layer — not by the knowledge system. A custom agent shell or compliance-aware Claude integration could prevent cross-project reads. The knowledge system itself is policy-neutral.

**Core evolution: human-controlled.** The user works in seven concurrent Claude sessions (tmux). Going to the core project to evolve it is natural workflow. Silos are read-only consumers of core by default. The human is the channel between projects — the system doesn't need to cross that boundary because the human already does.

### Separation of concerns — three layers

1. **Knowledge system** — stores, retrieves, serves knowledge via MCP. No opinion on access control. Provides the capability to connect or isolate.
2. **Connectivity** — peer-to-peer, opt-in per node. Each project chooses what it shares and with whom. Not hierarchical.
3. **Access control** — enforced by the interface layer (Claude Code, custom agent shell). This is where compliance boundaries live when needed. Not an immediate requirement but an inherent capability of the peer model — hard boundaries can be added without changing the underlying system.

### Open questions (remaining)

**Filesystem access boundary:** Does Claude Code have a hard boundary preventing access above the working directory? If so, MCP is the required portal for cross-project access (architectural forcing function). If not, MCP is chosen for its abstraction benefits, not forced by constraints. To be verified.

**MCP server as always-on requirement:** If core is served via MCP, the MCP server must be running for any project to have core capability. Is this acceptable, or should there be a fallback (read-only symlink, file-based bootstrap)?
