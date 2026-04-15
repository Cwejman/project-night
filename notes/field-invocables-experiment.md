# Field Invocables Experiment — Notes

*Date: 2026-04-14. Captured for later pickup.*

A session that started from an inbox idea about mediating archetypes and ended with two real invocables running in parallel through the engine, working a shared substrate. What follows is the trail — what was explored, what was proved, what was learned, and where it points.

---

## The starting thread

From `inbox.md`:

> "The thinking process can be architected, each cycle placed with transparency, archetypes orchestrated. For each cycle it is through a mediating archetype portrayed, so get to see over dispatch every change live... the human interface can even be real time, as for each cycle of thought arises from the space where the other thoughts are, each cycle can collaborate, speak to each other and just so can the human."

The idea: dispatch cycles shown live through typed mediating archetypes, on a canvas where all thoughts progress in parallel. The human enters the same field.

## What got explored

### 1. Types of thought that build a field

Fifteen sub-agents, each embodying a different domain (bioelectricity, jazz ensemble, mycorrhizal networks, category theory, embryogenesis, dissipative structures, Aboriginal songlines, glassblowing, swarm intelligence, dream stages, fermentation, pattern language, choreography, radio astronomy, immune system), were asked: *what are the types of thought that build a field?* Each returned 4-7 named types.

Recurring shapes across domains:

- **Gradient / baseline / difference** — establishing a difference so information flows (bioelectricity, embryogenesis, Prigogine, radio astronomy, Alexander)
- **Decay / evaporation / autolysis** — forgetting as a type of thought (mycorrhiza, swarms, fermentation, dreams)
- **Competence / costimulation / readiness** — readiness is prior to instruction (embryogenesis, immunology)
- **Trail-laying / track-laying / stigmergy** — leaving a trace others follow without meeting the thinker (swarms, songlines)
- **Breath / void / laying out / negative-space** — deliberate emptiness (glassblowing, Alexander, jazz, choreography)
- **Transfer / relay / antigen presentation** — handing what was found to the next reader (glassblowing, embryogenesis, immunology)

These are not metaphors for each other. They are the same shape appearing in fifteen materials.

### 2. Typed thoughts in the substrate (simulated)

A sandbox at `pilot/sandbox/thought-types.ts` proved that typed thoughts need no new primitives. A thinking-field archetype with `{ propagate: true, ordered: true, accepts: [thought-type-names] }`, each thought type as a chunk placed as `instance` on agent + `relates` on thinking-field, and each thought placed dually (instance on field with seq, instance on type). Same pattern as prompt/answer/tool-call on session in the bootstrap.

The substrate already supports multidimensional querying: scope a field for timeline, scope a type for kind across all fields, scope the intersection for filtered view, use connected scopes to see which types appear where.

### 3. Live cycles via Claude Code sub-agents

Haiku sub-agents were used as the completion model. Each cycle: agent reads the field, chooses a type, produces one thought, exits. Ten cycles on "what does it mean for a system to understand itself?" produced a natural arc — build (gradient → binding → integration → competence) → turn (rewriting broke the constructive frame) → deepen (threshold, trail-laying, relay) → dissolve (void, decay). Field structure emerged from types constraining what each cycle could do. No planner.

### 4. Engine discovery

The board was outdated. The engine at `pilot/engine/` is fully implemented — 64 tests across dispatch, boundary, protocol, process lifecycle, integration, bootstrap. The `await` operation is the only stub. The board has been updated to reflect this.

### 5. Real invocables through the real engine

Two invocables built that speak the JSON lines protocol via `pilot/engine/client.ts`, using the `claude` CLI (no API key needed) for completion:

- **Breaker** — reads the field, finds largest unbroken chunk, splits into two, repeats
- **Questioner** — reads the field, asks why about leaf chunks, answers questions; when an existing chunk already answers a why, it BINDS via `relates` placement instead of generating new text (the chunk IS the answer)

Both dispatched in parallel. The substrate was the coordination — no orchestrator. Full commit tracing per dispatch via `dispatch_id` on commits. Engine enforced boundaries (`readBoundary: ['agent']`, `writeBoundary: ['agent']`).

A run on `pilot.md` produced 55 breaks + 13 whys (68 chunks), 43 + 34 commits per dispatch respectively. Three times the questioner found its answer already present as an existing chunk and bound to it by placement.

### 6. Wholes-of-wholes reframe

The user's intervention: **"reality is built on wholes of wholes, reaching the end of a digestion is easier if what is digested starts small. What would be different not starting from big to smaller?"**

This changes everything. Starting big and breaking down is dismemberment — wholeness is lost at every split. Starting from small wholes and composing up preserves wholeness at every level. The **breaker becomes unnecessary**. What's needed instead is a **binder** — something that reads small wholes and discovers the structural relationships already there.

Rebuilt with invocables in `pilot/project/invocables/` (not fixtures — real invocables in their proper home):

- **Questioner** (same pattern, reads any unquestioned chunk)
- **Binder** — reads chunks, finds two that relate at a structural level, places `relates` between them. Does not generate new content. Discovers structure that is already there.

Ran on 9 small wholes (the values from `inside.md`, each distilled to its essence). Result: 22 chunks, 15 structural bindings, 13 questions with 4 answered by binding to existing chunks. The binder uncovered that the 9 values form a densely connected graph — "uncovered, not invented" binds to 4 other values; "honest weight" to 4; etc. That structure was already there; the binder just made it visible.

## Research landscape

A research pass surfaced these handles:

**Typed cognition**
- **Peirce's triad** (deduction, induction, abduction) — closest formal taxonomy of cognitive primitives. Ours are phenomenological, not inference-theoretic.
- **Minsky's Society of Mind** — typed cognitive agents composing into thinking. Architecturally close but kept a control architecture; we don't.
- **Dennett's Multiple Drafts** — parallel multitrack processes with no central theater. Our typed-thoughts field is this model made structural.

**Field-based computing**
- **Linda / tuple spaces** (Gelernter 1985) — closest computational ancestor. "Generative communication" through a shared associative medium.
- **Stigmergic Blackboard Protocol** (2026, open source) — active project implementing environment-based coordination for AI agents; distinguishes quantitative vs qualitative stigmergy.
- **Paul Welty's "Context as Facticity"** — contemporary thinker arriving at the same conclusions from continental philosophy: *"Put them in a room. Give them a shared medium rich enough to carry meaning. Let traces accumulate. Let vocabulary emerge. Trust the facticity."*
- **Blackboard + LLMs** (arxiv 2507.01701, 2025) — agents self-selecting via blackboard state.

**Wholes of wholes**
- **Koestler's holons** — entities simultaneously whole and part. Self-assertion + integration.
- **Alexander's centers** — field-like, defined by mutual intensification. The fifteen properties of living structure. *The Nature of Order* vol. 1.
- **Holonic manufacturing** (JANUS/ANEMONA) — the concrete computational implementation of holarchies, but applied to manufacturing; nobody has applied this to knowledge systems.

**Archetypal AI**
- **CoALA** (arxiv 2309.02427, Princeton 2023) — typed agent actions; validates the move of giving agents structurally different cognitive modes.
- **Levin's bioelectric cognition** — already cited in `inside.md` but the architectural parallel runs deeper than previously drawn. Cells = invocables, bioelectric field = substrate, morphogenesis = field growing by accumulation. *"The cognitive glue of bioelectrical networks."*
  - **Levin's challenge:** in bioelectric systems, cell roles EMERGE from position in the field — cells differentiate based on where they are, not what they were told to be. Our invocables have pre-defined archetypes. Should archetypes emerge from field position?

**Inside-out architectures**
- **Varela's autopoiesis** — a system that produces itself from itself. Our self-describing field is autopoietic architecture. But Varela requires operational closure; we're closer to what Varela later called **enaction**.
- **Clark's Extended Mind** (1998) — "knowledge as identity" is Clark's thesis stated more radically. But Clark addressed individual cognition; we're doing collective cognition in a shared medium. Novel territory.

## The Harmona connection

The user pointed to `Harmona Lab Read Me 2.7.pdf`. It is the same architecture seen from the institutional side.

- **Three-Layer Sensemaking** (material / pattern / purpose) is typed cognitive acts applied to decisions. The three layers *run simultaneously and are evaluated for distortions relative to each other*.
- **Triadic Governance** is the binder invocable as organizational primitive. Triads *rotate, mix across domains, and dissolve when their scope is complete*. They *compose recursively*.
- **Regenerative Cooperative Circulation** is the substrate as economic primitive. Knowledge as circulatory capacity rather than proprietary accumulation.
- **Five Capitals** (Knowledge, Ecological, Social, Coordination, Financial) are scope dimensions. A single act lives at the intersection of all five.
- **Sequencing multiplier** — order and combination release outcomes individual protocols cannot produce. Not additive but multiplicative. Same insight: *the relationships between wholes are not reducible to the wholes themselves*.

## The load-bearing insight

The user asked: *"what makes Harmona work — some wholes verified by humans and the rest flows from there?"* Then flagged the question as possibly leading.

It was. The answer is not verification.

**What makes Harmona work is relational coherence, not verification.** No one certifies truth. No authority accumulates. Triads rotate and dissolve. Three-Layer Sensemaking doesn't produce truth by certifying facts — it surfaces distortion by forcing three layers into simultaneous co-presence. A fact that doesn't fit a pattern exposes either the fact or the pattern. A pattern that violates purpose exposes either the pattern or the purpose. Incoherence becomes visible because you can't hold all three at once if something's off.

Triads are three not for consensus — two can distort together quietly; three makes distortion visible.

The triadic review at commons-gating isn't certification. It's immune-system logic: T cells don't mark cells as "self," they reject what fails to present correctly. Absence of incoherence, not presence of verified truth.

**Reliability is what survives simultaneous intersection across multiple dimensions.** That is an inside-out property of the field, not an external stamping. A verification system bottlenecks at the verifier. A coherence system scales with the richness of its dimensions.

This is why our substrate is the right shape. Every chunk exists at scope intersections. Anything incoherent fails to hold at an intersection. Reliability compounds as dimensions multiply.

## The next step

Pairs drift together. Three angles surface distortion.

We have two archetypes (questioner, binder). Both generative. Neither checks whether what's in the field still holds. Harmona's triadic pattern points to the third:

- **Questioner** probes the material — pulls at individual chunks
- **Binder** surfaces the pattern — finds what relates
- **???** holds the purpose — checks coherence across dimensions; surfaces distortion where dimensions disagree

The third archetype is not a verifier. It doesn't certify. It reads the field and places **tension markers** — `relates` between chunks that should cohere but don't, labeled with why. Its output is not new content. It's the immune cell. It says "this doesn't present correctly at this intersection — look here."

Concrete next moves:

1. **Build the third archetype.** A new invocable that reads the field across multiple dimensions simultaneously and surfaces distortion. No new content. Only tension-markers via placement.

2. **Let chunks live at more intersections.** Right now chunks mostly live at type + field. The triadic insight says every meaningful claim should be placed at intersections of material, pattern, and purpose (or whatever three dimensions the field organizes around). More intersections means more distortion-surfaces.

3. **Run all three in parallel.** Not one archetype working alone. Three running concurrently, each from a different stance, the substrate coordinating them, distortion becoming visible as structural incoherence between their outputs.

That's the triadic pattern made substrate-native. The field checking itself.

## The Levin horizon

Beyond the triad: the archetypes themselves could emerge from the field rather than being designed in advance. In bioelectric systems, cell roles are not assigned — they differentiate based on position in the field. A fully inside-out system would derive its own cognitive modes from its own structure. The typed thoughts (gradient, void, binding...) would not be seeded — they'd be discovered by the field working on itself.

This is the autopoietic horizon. Not the next step, but the one after.

## Where the experiment files lived

All deleted during cleanup, but for reference:

- Sandbox scripts: `pilot/sandbox/` (thought-types sandbox, various runner scripts)
- Draft invocables: `pilot/engine/fixtures/` (digest, breaker, questioner — wrong location, these were fixtures)
- Final invocables: `pilot/project/invocables/` (questioner, binder — the right location for real invocables)

If this thread is picked up again, the right place for new invocables is `pilot/project/invocables/`, and they should import `../../engine/client.ts` to speak the protocol. The harness pattern for dispatching them in parallel is straightforward and was proved out — engine bootstraps the db, creates two dispatches with `agent` read/write boundary, spawns via `spawnInvocable`, waits on `Promise.all([...exited])`. A copy of that pattern can be reconstructed from `pilot/engine/test/integration.test.ts` and the existing bootstrap seed.

## Things to carry forward

- **Typed thoughts need no new primitives.** The substrate's existing spec system (propagate, accepts, ordered) is enough. Thought-type archetypes compose via dual placement (instance on field + instance on type).
- **Claude Code CLI is the completion backend for invocables.** `claude -p --model haiku --no-session-persistence --system-prompt <s>` with stdin piping. No API key management. Already authenticated.
- **Stdin piping, not arg passing.** Content with leading dashes breaks arg parsing. Use `stdin: 'pipe'` and `proc.stdin.write(prompt); proc.stdin.end()`.
- **JSON extraction.** Haiku sometimes wraps responses in markdown. Use `response.match(/\{[\s\S]*\}/)` not `.replace('```json')`.
- **Name uniqueness per scope is enforced.** Include chunk IDs in names for uniqueness. `answer-${id.slice(0, 8)}`.
- **Wholes, not dismemberment.** Start with small meaningful chunks. The binder is the primary act, not the breaker.
- **Binding by placement, not by text.** If an existing chunk IS the answer, place a `relates` on the question pointing to it. Don't regenerate text.
- **Idle waiting between parallel invocables.** One invocable may produce chunks another is waiting for. A simple idle-count with wait was enough; real systems would use services or event subscriptions.

## If returning to this

The most alive thread: **build the third archetype and complete the triad.** Everything else is refinement. The structural insight from Harmona — that reliability comes from relational coherence across dimensions, not from verification — demands a third invocable that detects distortion. That's the move that makes the pattern real.

After that: multi-dimensional placement (chunks at more intersections), then emergent archetypes (Levin horizon), then services (long-running invocables that watch the field continuously rather than running to completion).

The substrate is ready. The engine is ready. The pattern is proved. What remains is to build the third.
