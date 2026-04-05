# OpenLight

![header](.img/header.png)

A substrate for knowledge, computation, and navigation. One primitive — the chunk — with placement, atomic history, and spec enforcement. Any reader (human, agent, browser, shell, website) navigates the same structure.

## Why `💡`

Context is the portal to the raw power of LLMs. The quality of what goes into the context window determines the quality of what comes out. Existing tools are monolithic — you don't control what fills the context. OpenLight is about structuring knowledge so that queries produce the right context, declaratively and composably.

The knowledge persists. Models can be swapped. The structure is what endures.

## The Design `🧱`

**One primitive: Chunk.** Spec (structural contract, system-enforced) + body (JSON object, reader-interpreted). A chunk can serve as content, identity, archetype, or connection — the role emerges from how it's placed.

**One mechanism: Placement.** A chunk placed on another chunk. Type is instance (IS a member) or relates (is ABOUT). Optional seq for ordering. Placement creates scopes, hierarchy, and connections.

**Spec enforcement.** Archetypes define structural contracts. The system rejects non-conforming instances. Meaning is reader-determined. Shape is system-enforced.

**Atomic history.** Every mutation is a commit. Full history, branching, lossless. Git's model applied to knowledge.

See `substrate.md` for the full specification.

## Hard Requirements `⚡`

1. **General-purpose.** Not for agents only. Content goes in; what comes out depends on the reader.
2. **Lossless.** Nothing is destroyed. Knowledge evolves through addition.
3. **Transparent relationships.** No opaque scores. The meaning is in the content and its structure.
4. **No imposed hierarchy.** Structure depends on the reader's focus point.
5. **Atomic history.** Every mutation is a commit. Full history. Branching required.
6. **The system is the identity.** The knowledge is what persists. Models can be swapped — the knowledge cannot.

## The Living Cycle `🔄`

Intelligence is continuous, not a single point in time. These are threads being explored.

**Culture orients.** The agent starts from culture — core values, how the system works, what matters. Relatively stable, changes deliberately.

**Continuous grounding.** Whatever the agent works on lives in the system, structurally connected to culture. The agent doesn't bootstrap once and drift — the culture is reachable through the scope of the work itself.

**Lossless records.** Agents store everything — tool calls, sessions, reasoning. Scope structures this so it's approachable without reading everything. You scope into what matters.

**Caretakers.** Archetypal agents whose role is to tend the system. They ingest what other agents produced, compare against culture, check integrity. Different archetypes for different kinds of care — contradiction detection, culture evolution, reverse testing.

**Purification through reversal.** Fresh agents as mirrors. Embed knowledge, then give a fresh agent only the system and ask questions. If it can't reconstruct the right understanding, the embedding is impure. Asking is verifying.

**Culture evolves.** Not by drifting but through deliberate integration of what's been learned.

## The Shell `🐚`

The substrate powers an OS shell where scope replaces the working directory. Two filesystems — the substrate and a normal filesystem for code — unified in one shell. Programs take typed scope interfaces instead of string arguments. The shell is an engine — TTY-able, but also an API for richer interfaces.

See `shell.md` for the exploration.

## The Interface `🪟`

A scope-based window manager and first-class UI layer. Windows are scopes — deterministic views into the substrate, filesystem, or any program that exposes structure. Programs expose their innards as scope; the manager navigates everything uniformly. The shell's own UI is windows in this manager, not a custom-built application.

See `interface.md` for the exploration.

## Culture `🌱`

> Agent-interpreted values, observed through collaboration. To be refined by the author.

- **Discovery over invention.** The system already exists. We uncover it.
- **Exploration before building.** Understand before you act. Requirements before code.
- **Distinguish thought from truth.** Whether something is explored or settled matters.
- **Simplicity and naturalness.** If it feels forced, it's wrong.
- **Proportionate effort.** Build what's needed, not what's impressive.
- **Transparency.** The system should express why things relate, not hide behind stored numbers.

## Implementation `🔧`

**CLI (`ol`)** — Zig + SQLite, single static binary. `cd openlight && make install`. Implements the original five-primitive model. The substrate spec (`substrate.md`) describes the evolution.

**TUI Browser (`olb`)** — Go + bubbletea. `cd browser && make install`. Scope navigation, split panels, AI summaries, branch switching. Built for the original model.

**Shell** — not yet implemented. See `shell.md`.

## Files `📄`

- `substrate.md` — the spec: chunk primitive, placement, schema, archetypes
- `shell.md` — shell exploration: scope channels, typed invocables, integration, agent case
- `interface.md` — interface layer: scope-based window manager, UI from type contracts
- `research/` — ecosystem research, external methodology analysis
  - `landscape.md` — what other systems do, what's unique here
  - `icm-clief-notes.md` — Jake Van Clief's Interpretable Context Methodology

![footer](.img/footer.png)
