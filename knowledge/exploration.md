# Knowledge System Exploration — 2026-03-15

## The Primitives (Settled)

Five primitives. Everything else composes from these.

**Chunks.** A unit of meaning. Text content + optional key/value pairs. A chunk must be broken when separate parts have different dimensional weights.

**Dimensions.** A named phenomenon. No rigid schema — just a name and whatever chunks have weight on it. Anchored by meta-chunks (chunks with weight on exactly one dimension). Dimensions connect through shared chunks.

**Weights.** A number (0.0–1.0) plus a binary quality: `instance` (this chunk IS a member of the dimension) or `relates` (this chunk is ABOUT the dimension). Instance/relates enables collections, trees, and contracts to emerge without imposing hierarchy.

**Commits.** Every mutation is atomic and recorded. The system is a chain of commits, like git. HEAD is always browsable. Any historical state is reconstructable. Branching is supported — run parallel explorations, review, merge to main.

**Peers.** Knowledge systems can read from each other. A consuming system reads a peer but doesn't mutate it. This decouples concerns — integrations, culture, contracts can each be their own peer.

## Hard Requirements (Settled)

1. **General-purpose substrate.** Not for agents specifically. Content goes in; what comes out depends on the reader. An agent bootstraps, a website generates UI, a TUI browses. The system is one thing; the interfaces are many.
2. **Lossless.** Nothing is destroyed. Knowledge evolves through addition and re-weighting, not deletion or overwriting. Any historical state is recoverable.
3. **Transparent relationships.** The system knows and expresses WHY things relate, not just THAT they are related. No opaque similarity scores. The intelligence is in the relationship, visible to the reader.
4. **No imposed hierarchy.** Structure is relative to the reader's focus point. Hierarchy can emerge from reading (via instance/relates), but is not baked into storage.
5. **Atomic history.** Every mutation is a commit. Full history preserved. Branching required.
6. **The system is the identity.** For agents: the knowledge is the agent, the LLM is interchangeable. For other consumers: the system is the source of truth, interfaces are projections.

## Settled — Approach

7. **Deliberate writes initially.** The low-level completion-model cycle is deferred. Claude's existing capability suffices for exploration with deliberate writes to the system.
8. **Knowledge system is the source of truth.** Code is material molded against knowledge. Filesystem is the world's interface; truth resides in the system.
9. **Three software pieces.** CLI (primary, agents use this), browser (TUI first, then web), Claude plugin (later). All git-based.

## Key Insight: The Primitives Compose

The intent was to find the simplest possible elements that can build everything. The five primitives — chunks, dimensions, weights (with instance/relates), commits, and peers — appear sufficient.

**Instance/relates builds tree-like structures.** A "git-integration" dimension collects all git references (each is an `instance`). An "integration-contract" dimension collects all contracts. A contract chunk's body tells an agent how to execute the resolution. Trees emerge from instance/relates without imposing hierarchy.

**Key/value pairs on chunks make them records.** A person chunk has `{name: "Alice", phone: "..."}`. A reference chunk has the parameters a contract needs to execute. The browser can recognize chunk types from their fields.

**Peers decouple systems built on the same primitives.** An integration module is its own peer knowledge system. A culture module is another. A project reads from both but doesn't mutate them. Systems can depend on each other — as long as decoupled and touched with care.

**The browser depends on this structure.** The browser relates to each integration type and has its own UI implementation for it — taking the payload and knowing how to view it. Views and view testing/enforcing are the contracts between the browser and the knowledge system. If the structure changes, the browser breaks — but as long as that is clear, it's manageable.

**Agents can now depend on the structure too.** An integration contract is readable by the agent — it contains the body to execute the tool call. The relationships make enough for the agent to act. This structure IS the contract, for both browser and agent.

## The Scope Model (Settled)

Scope is a set of dimensions. Add a dimension → narrows. Remove → widens. Scope IS the query.

- Navigation is free. Add or remove any dimension at any point.
- You primarily see dimensions with generated summaries. Chunks are read when scope is narrow enough.
- Empty scopes show adjacency — what you'd gain by relaxing a dimension.
- Pre-scoped entry: an agent bootstraps with a specific scope; a website page is a fixed scope.

See `browser-user-story.md` for the full walkthrough.

## Integrations (Settled — Uses Existing Primitives)

No new primitive needed. See `integrations-and-history.md`.

- A reference is a chunk with key/value fields containing the parameters a contract needs to resolve it.
- Multiple chunks per reference: the reference becomes a dimension. The reference chunk is `instance`; describing chunks `relate`.
- Integration contracts are themselves chunks — `instance` of an "integration-contract" dimension. The body tells the agent how to execute.
- The integration module is a peer knowledge system — decoupled, read-only from the consumer.
- Caching and staleness detection are agent concerns, not DB concerns.

## Views (Explored, Not Fully Settled)

See `views-and-external-world.md`.

- A view is a scope + display settings → produces a result.
- Views can be ephemeral, saved, or approved (creating a dependency).
- Approved views enable drift detection — if knowledge changes, the system flags that the view's output has changed.
- The website-as-browser concept: each page is a saved view with specific scope + display.
- Views are also the contract between the browser and the knowledge system — view testing/enforcing.

## Agentic Integration (Explored, Partially Settled)

See `agentic-integration.md`.

- The agent/human is the actor. They write chunks, create dimensions, assign weights, manage references.
- The DB doesn't ingest, discover, suggest, or resolve. It stores what was put in.
- The breathing metaphor (inhale knowledge, exhale understanding) and identity equation (knowledge IS the agent) are settled.
- The low-level completion-model cycle is deferred. Deliberate writes for now.

## Validated by Stress Testing

8 agents tested the model across 4 domains (culture, organization, software, website). See `agent-stress-test-synthesis.md`.

- Core model validated across all domains.
- Instance/relates resolved the primary tension unanimously.
- Key/value pairs essential for operational domains.
- Dimension properties not needed — collection vs topic emerges from usage.

## Research Grounding

See `research-map.md` for the full ecosystem research: RAG limitations, SAEs, Conceptual Spaces, vector DB mechanics, alternative query paradigms, agent memory systems.

## Remaining Open Questions

These are mostly agent/tooling concerns, not DB model questions

Comments by Claude:

- **Weight assignment.** Subjective. Agent tooling could suggest weights (embeddings, calibration). Not a DB primitive.
- **Dimension lifecycle.** When does a chunk earn its own dimension? Practical question for agents/humans, not structural.
- **Temporal ordering.** Content-level dates aren't dimensional weights. Key/value pairs (e.g., `{date: "2026-03-15"}`) handle this for records. The commit history handles mutation time.
- **Causality / prescriptive authority / scope union-negation.** Strains identified by the stress test. May be addressable through conventions (causality as a dimension, prescriptive weight, umbrella dimensions for union) rather than new primitives. To be explored when practical needs arise.

Next up:

- **Views mechanics.** Approved views, drift detection, view testing — the concept is there, exact mechanics not settled.
- **Storage technology.** What backs this? The commit model + dimensional weights + key/value pairs could map to various backends. Not yet chosen.
