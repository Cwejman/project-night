# OpenLight — 2026-03-21

## What This Is

A knowledge system built on a few simple principles. Chunks of meaning on named dimensions, with binary membership, atomic history, and decoupled peers. The CLI (`ol`) is built and working. The exploration is now about culture, testing with real content, and how agents work within the system over time.

The primitives were discovered through exploration, not designed upfront. They turned out to be the simplest set that handles everything tested so far.

## Why It Matters

Good models matter — the difference between models is real and significant. But even a good model starts each session with an empty context. Agents are extremely flexible in how they operate, all depending on the context they have. This is key and has always been key. Given good context they produce good results, given poor context they drift. What you put in that context shapes everything.

OpenLight is about structuring what goes in. Knowledge where relationships are transparent, history is preserved, and any reader (agent, browser, human) can navigate the same structure. The model can be swapped; the knowledge persists.

## The Primitives (Settled)

Five primitives. Everything composes from these.

**Chunks.** A unit of meaning. Text content + optional key/value pairs.

**Dimensions.** A named phenomenon. No schema — just a name and whatever chunks belong to it. Dimensions connect through shared chunks.

**Membership.** Two binary relations between a chunk and a dimension:
- `instance` — this chunk IS a member of the dimension.
- `relates` — this chunk is ABOUT the dimension.

Both are binary. The structure tells the reader where to look; the reader discovers what it means by reading.

**Commits.** Every mutation is atomic and recorded. Full history. Branching supported.

**Peers.** Knowledge systems can read from each other without mutating. Culture, integrations, contracts can each be their own peer.

## Culture — The Focal Point

Culture is the set of values and orientation that agents bootstrap from. Not a manual — a few core values that apply across any domain. Like how someone with deep experience can work in an unfamiliar field because they carry good judgment that transfers.

Culture lives in the system as a peer. It's always accessible through the dimensions, connected to whatever the agent is working on.

A good culture starts small. Core values at the center, detail only where needed. If the values are clear enough, the agent doesn't need instructions for every scenario — it can work well from orientation alone.

The size of the culture will grow organically. We don't need to know upfront how much is needed. That becomes clear through use.

> **Agent-interpreted values.** The following are the agent's interpretation of the author's values, observed through collaboration. They are not written by the author and should be refined or replaced.
>
> - **Simplicity.** Don't do something wasteful when there's a simpler way. Like nature — the most natural path.
> - **Exploration before building.** Understand before you act. Requirements before code.
> - **Distinguish thought from truth.** Whether something is explored or settled matters. Don't present hypotheses as conclusions.
> - **Transparency.** The system should express why things relate, not hide behind stored numbers.
> - **Discover what already is.** Not novelty for its own sake — finding the structure that was always there.
> - **Proportionate effort.** Build what's needed, not what's impressive.

## The Living Cycle (Exploring)

Intelligence is not one point in time — it's continuous. What follows are threads of thought being explored, not a settled design.

**Culture orients.** The agent starts from culture — core values, how the system works, what matters. Relatively stable, changes deliberately.

**Continuous grounding.** Since whatever the agent works on lives in the system, it's dimensionally connected to culture. The agent doesn't bootstrap once and drift — the culture is structurally reachable through the dimensions of the work itself.

**Lossless records.** Agents store everything — tool calls, session dialogues, reasoning. Dimensions structure this so it's approachable without reading everything. You scope into what matters. Whether shared or per-agent, and the exact protocol, is open.

**Caretakers.** Archetypal agents whose role is to tend the system. They ingest what other agents produced, compare against culture, check integrity. Different archetypes for different kinds of care — contradiction detection, culture evolution, reverse testing.

**Purification through reversal.** Using fresh agents as mirrors. Embed knowledge, then give a fresh agent only the system and ask questions. If it can't reconstruct the right understanding, the embedding is impure. If answers contradict the culture, something needs reconciling. Asking is verifying.

**Culture evolves.** Not by drifting but through deliberate integration of what's been learned. How exactly this works is open.

## Hard Requirements (Settled)

1. **General-purpose.** Not for agents only. Content goes in; what comes out depends on the reader.
2. **Lossless.** Nothing is destroyed. Knowledge evolves through addition.
3. **Transparent relationships.** No opaque scores. The meaning is in the content and its structure.
4. **No imposed hierarchy.** Structure depends on the reader's focus point.
5. **Atomic history.** Every mutation is a commit. Full history. Branching required.
6. **The system is the identity.** The knowledge is what persists. Models matter, but they can be swapped — the knowledge cannot.

## Scope

Scope is a set of dimensions. Add a dimension to narrow. Remove to widen. Scope is the query.

With chunks on dimensions and binary membership, navigation works by composing and decomposing scopes. The browser does this visually, the agent does it programmatically, a website enters with fixed scopes. Same structure, different interfaces.

See `browser-user-story.md` for the full walkthrough.

## Open Questions

- **Binary membership and evolution.** Without weights, you can't express "this chunk is becoming less relevant." You can only keep or remove the membership. Whether this forces dimension proliferation in practice is unknown. Kumiho's tag pointer mechanism may handle this more gracefully (see `in-depth/alternatives-grounded.md`). Needs testing with real content.

- **Typed edges vs dimensional membership.** Typed-edge graphs can query CAUSED_BY or CONTRADICTS directly. In OpenLight, the reader has to read to discover the nature of a relationship. Neither is obviously better. See `in-depth/alternatives-grounded.md`.

- **Dimension lifecycle.** When does a chunk earn its own dimension?

- **Causality, prescriptive authority, negation.** Known strains. May be addressable through conventions rather than new primitives.

- **Impact analysis.** No mechanism for "if this changes, what else might break?"

- **Culture articulation.** The agent-interpreted values above are a starting point. The author's own articulation is the next step.

## Next Steps

1. **Articulate the culture.** Core values in the author's own voice. Doesn't need to be large. A few values that extend naturally.

2. **Use the system with real content.** Not a formal test battery — genuine use. Take real knowledge, put it in through the CLI, navigate it, see what works and what doesn't.

3. **Start the living cycle.** As content enters the system, try the caretaker patterns. Reverse testing, integrity checks, culture updates. Start small.

Agent-generated test protocols are in `in-depth/` as reference, but the path forward is organic use, not benchmarking.

## Implementation

**CLI** — complete. 16 build steps, all passing. Zig + SQLite, single static binary, installed as `ol`.

**TUI Browser** — working. Go + bubbletea, installed as `olb`. Scope navigation with split panels, AI-generated summaries (haiku, seeded from culture), branch switching, undo/redo. See `tui-specification.md`.

See `specification.md` for the data model, schema, commands, and formats.
See `implementation-process.md` for how it was built.
See `client-server-architecture.md` for deployment model questions.

## Related Files

**Core (bootstrapped):**
- `specification.md` — CLI spec, data model, schema, commands
- `browser-user-story.md` — scope navigation walkthrough
- `entities-and-siblings.md` — how instance/relates handles structured entities
- `integrations-and-history.md` — how external content is referenced
- `views-and-external-world.md` — views, drift detection, website-as-browser
- `implementation-process.md` — how the CLI was built
- `client-server-architecture.md` — deployment model (unsettled)
- `tui-specification.md` — terminal UI (unsettled)

**In-depth (reference, not bootstrapped):**
- `in-depth/research-map.md` — ecosystem research, 50+ systems
- `in-depth/alternatives-grounded.md` — comparison with MemoryGraph, MAGMA, Kumiho, Letta MemFS
- `in-depth/testing-framework.md` — agent-generated test protocols
- `in-depth/comparative-test-protocols.md` — test content (Sunward scenarios)
- `in-depth/agentic-integration.md` — earlier metaphors and identity exploration
- `in-depth/agent-stress-test-synthesis.md` — historical stress test results
- `in-depth/session-dialog.md` — session transcript from initial exploration (2026-03-15/18)
- `in-depth/session-dialog-2026-03-20.md` — ecosystem research session, culture as focal point, living cycle threads, language/tone feedback
