# Knowledge System Exploration — 2026-03-18

## The Primitives (Settled)

Five primitives. Everything composes from these.

**Chunks.** A unit of meaning. Text content + optional key/value pairs. A chunk must be broken when separate parts belong to different dimensions.

**Dimensions.** A named phenomenon. No rigid schema — just a name and whatever chunks belong to it. Anchored by meta-chunks (chunks on exactly one dimension). Dimensions connect through shared chunks.

**Membership.** Two binary relations between a chunk and a dimension:

- `instance` — this chunk IS a member of the dimension. Structural: member or not.
- `relates` — this chunk is ABOUT the dimension. Structural: related or not.

Both are binary. The structure tells the reader WHERE to look; the reader discovers WHAT it means by reading. Continuous weights (0.0–1.0) were explored and rejected — they inject opaque numerical judgment, the same problem as embedding-based systems. The system's transparency requires that stored relations be self-evident, not dependent on an external model's tuning. Qualitative gradients (low/mid/high) may be explored later if practical needs demonstrate they're necessary.

Instance/relates enables collections, trees, and contracts to emerge without imposing hierarchy.

**Commits.** Every mutation is atomic and recorded. The system is a chain of commits, like git. HEAD is always browsable. Any historical state is reconstructable. Branching is supported — run parallel explorations, review, merge to main.

**Peers.** Knowledge systems can read from each other. A consuming system reads a peer but doesn't mutate it. This decouples concerns — integrations, culture, contracts can each be their own peer.

## Hard Requirements (Settled)

1. **General-purpose substrate.** Not for agents specifically. Content goes in; what comes out depends on the reader. An agent bootstraps, a website generates UI, a TUI browses. The system is one thing; the interfaces are many.
2. **Lossless.** Nothing is destroyed. Knowledge evolves through addition, not deletion or overwriting. Any historical state is recoverable.
3. **Transparent relationships.** The system knows and expresses WHY things relate, not just THAT they are related. No opaque similarity scores, no opaque stored numbers. The intelligence is in the knowledge and its structure.
4. **No imposed hierarchy.** Structure is relative to the reader's focus point. Hierarchy can emerge from reading (via instance/relates), but is not baked into storage.
5. **Atomic history.** Every mutation is a commit. Full history preserved. Branching required.
6. **The system is the identity.** For agents: the knowledge is the agent, the LLM is interchangeable. For other consumers: the system is the source of truth, interfaces are projections.

## Settled — Approach

7. **Deliberate writes initially.** The low-level completion-model cycle is deferred. Claude's existing capability suffices for exploration with deliberate writes to the system.
8. **Knowledge system is the source of truth.** Code is material molded against knowledge. Filesystem is the world's interface; truth resides in the system.
9. **Three software pieces.** CLI (primary, agents use this), browser (TUI first, then web), Claude plugin (later). All git-based.

## Key Insights

### The Primitives Compose

The intent was to find the simplest possible elements that can build everything. The five primitives — chunks, dimensions, membership (binary instance/relates), commits, and peers — appear sufficient.

**Instance/relates builds tree-like structures.** A "git-integration" dimension collects all git references (each is an `instance`). An "integration-contract" dimension collects all contracts. A contract chunk's body tells an agent how to execute the resolution. Trees emerge from instance/relates without imposing hierarchy.

**Key/value pairs on chunks make them records.** A person chunk has `{name: "Alice", phone: "..."}`. A reference chunk has the parameters a contract needs to execute. The browser can recognize chunk types from their fields.

**Peers decouple systems built on the same primitives.** An integration module is its own peer knowledge system. A culture module is another. A project reads from both but doesn't mutate them. Systems can depend on each other — as long as decoupled and touched with care.

**The browser depends on this structure.** The browser has its own UI implementation per integration type — taking the payload and knowing how to view it. Views and view testing/enforcing are the contracts between the browser and the knowledge system. If the structure changes, the browser breaks — as long as that is clear, it's manageable.

**Agents can depend on the structure too.** An integration contract is readable by the agent — it contains the body to execute the tool call. The relationships make enough for the agent to act. This structure IS the contract, for both browser and agent.

### Navigation Is Inherent to the Structure

Scope-as-query — composing dimensions to find relevant chunks — is not a designed navigation paradigm. It is the natural consequence of the structure. Given chunks on dimensions with binary membership, the only way to traverse the system is by composing and decomposing dimensional scopes. Different consumers do this differently: the browser presents it visually, the agent queries programmatically through the CLI, the website enters with fixed scopes. But the navigation model is the same because it is inherited from the structure itself.

Connection strength between dimensions at a given scope is computed from shared chunk counts — structural and transparent, not a stored number.

### Storage Maps to Existing Backends

The storage model — chunks with text + key/value pairs, binary membership on named dimensions, commit-based history — is simple enough to map to various backends (graph DB, document store, relational DB with version control). This is a practical observation: no new database engine needs to be invented. The novelty is the structure and what it enables, not the storage technology.

### Confirmed by Ecosystem Research

Comprehensive research (30+ agent memory systems, SAE-based interpretable embeddings, conceptual spaces, knowledge graphs, version-controlled databases, scope-based query systems) confirms: no existing system has this structure. The pieces exist in separate communities — dimensional navigation, git-like knowledge versioning, named interpretable dimensions, general-purpose substrate serving multiple consumers — but nobody has unified them. See `research-map.md`.

## The Scope Model (Settled)

Scope is a set of dimensions. Add a dimension → narrows. Remove → widens. Scope IS the query.

- Navigation is free. Add or remove any dimension at any point.
- You primarily see dimensions with generated summaries. Chunks are read when scope is narrow enough.
- Empty scopes show adjacency — what you'd gain by relaxing a dimension.
- Pre-scoped entry: an agent bootstraps with a specific scope; a website page is a fixed scope.
- Connection strength between dimensions is computed from shared chunk counts at the current scope — structural, not stored.

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

- The agent/human is the actor. They write chunks, create dimensions, assign membership, manage references.
- The DB doesn't ingest, discover, suggest, or resolve. It stores what was put in.
- The breathing metaphor (inhale knowledge, exhale understanding) and identity equation (knowledge IS the agent) are settled.
- The low-level completion-model cycle is deferred. Deliberate writes for now.

## Validated by Stress Testing

30 agents tested the model across multiple domains and dimensions of the problem. Initial 8-agent run covered culture, organization, software, and website — see `agent-stress-test-synthesis.md`. Further testing confirmed the core finding.

The consistent result: the model was discovered, not invented. The primitives are the simplest path that handles everything. No shortcuts led anywhere better.

- Core model validated across all domains.
- Instance/relates resolved the primary tension unanimously.
- Key/value pairs essential for operational domains.
- Dimension properties not needed — collection vs topic emerges from usage.

Note: the stress test recommended 0.0–1.0 continuous weight for `relates`. This was subsequently simplified to binary — the gradient introduced the same opacity as embedding-based systems. Binary membership is transparent; the reader understands relevance by reading, not by trusting a stored number.

## Confirmed Next Step

10 agents confirmed: hand-build real content using the primitives. Do not design further in the abstract. Take actual knowledge — from a real project, a real organisation, real source material — and build it using chunks, dimensions, binary membership, commits. The model will be tested where it counts: in practice, not in stress tests.

## Remaining Open Questions

- **Dimension lifecycle.** When does a chunk earn its own dimension? Practical question for agents/humans, not structural.
- **Temporal ordering.** Content-level dates aren't dimensional membership. Key/value pairs (e.g., `{date: "2026-03-15"}`) handle this for records. The commit history handles mutation time.
- **Causality / prescriptive authority / scope union-negation.** Strains identified by the stress test. May be addressable through conventions (causality as a dimension, prescriptive membership, umbrella dimensions for union) rather than new primitives. To be explored when practical needs arise.
## Database Architecture (Settled)

**Zig + SQLite hybrid.** SQLite for durable storage, indexing, transactions, crash recovery. Zig for CLI, commit/branch management, scope query construction. Single static binary with SQLite compiled in.

**Why this approach:**
- Full custom DB (pure Zig): disproportionate. Crash recovery and durability take months to get right — SQLite solved this decades ago.
- Pure SQLite (no Zig query layer): scope queries degrade as multi-way self-joins at scale. Manageable early, but the structure calls for bitmap intersection, not relational joins.
- Zig + SQLite: proportionate. Proven storage + fast CLI. The innovation is the data model, not the storage engine.

**Architecture:**
- Versioned rows. Every mutation produces version rows (chunk_versions, membership_versions) tagged with the commit that created them. History IS the versioned rows. No separate event log. Dimensions are implicit — they exist when memberships reference them.
- Current state resolved by walking parent pointers from branch HEAD to root, then taking the most recent version row per entity in that ancestry.
- Branches are pointers to commits — like git refs. Creating a branch is creating a ref. No data is copied. History is immutable and does not need replication.
- Diffing is a system capability — compare resolved states at any two commits to show what was added, removed, or changed.
- Merging is NOT a system operation. Merge requires agency — an agent or human reads both branches (via diff), understands the content, and writes the result. The system provides visibility, not resolution.
- Peers: two approaches to test. SQLite's `ATTACH DATABASE` (native, read-only access to another `.db` file) vs Zig-layer abstraction. Open question — worth testing both.
- Optional: Roaring Bitmaps in memory for fast scope intersection at scale (bitwise AND across dimensions — microseconds). A materialized current-state cache can be maintained and updated on each commit.

**Key properties:**
- Single `.db` file IS the knowledge system. Portable, inspectable, backupable.
- ~1ms startup. Agents call the CLI programmatically, potentially many times per session.
- Cross-compiles to any platform from one machine (Zig's strength).
- C ABI export possible — the DB could later be used from any language via FFI.

**Zig ecosystem:**
- SQLite: raw C API via `@cImport` (proven by Bun) or vrischmann/zig-sqlite (573 stars, comptime type-checked).
- CLI: zig-clap (1.5k stars).
- JSON: built into Zig stdlib.
- Roaring Bitmaps: zroaring (pure Zig) or jwhear/roaring-zig (CRoaring bindings).

**Risk:** Zig is pre-1.0 (targeting 2026). Thinner ecosystem than Rust. At ~3k lines with C interop as the core, ecosystem risk is low.

**Estimated size:** ~2,000-3,500 lines of Zig. ~2 months for a working CLI with all core commands.

## CLI Design (Explored, Converging)

Three parallel explorations (from primitives, from agent consumer, from browser/reader) converged on the same core insight: **the write interface is one operation — submit a declarative JSON mutation.** Everything else is reads and branch management.

### The JSON Mutation Format

One JSON structure serves as:
- The **write format** — what you submit to change the system
- The **commit content** — what's stored as the commit
- The **diff format** — what you see when you look at a commit or diff between two points

The JSON is **declarative, not imperative.** You describe what should be true, not what operations to perform. The system computes the diff.

```json
{
  "chunks": [
    {
      "text": "The summer youth program runs June through August...",
      "kv": {"status": "active", "capacity": 60},
      "instance": ["community-programs", "projects"],
      "relates": ["education", "people"]
    },
    {
      "id": "c_019",
      "text": "revised understanding of the website project...",
      "instance": ["projects", "design"],
      "relates": ["people"]
    },
    {
      "id": "c_005",
      "removed": true
    }
  ]
}
```

- No `id` → new chunk. System creates it. Dimensions referenced in membership are created if they don't exist.
- Has `id` → update. Provided fields replace existing. Fields omitted are left unchanged.
- `"removed": true` → explicit removal (lossless — recorded in commit history, not physically destroyed).
- Membership fields (`instance`, `relates`) when provided are the **complete set** — declaring the truth, not adding to it. The system computes what changed. Partial membership updates may be added later if practical needs arise.

The agent builds this JSON in its own context, reasons about it, revises it until satisfied, then submits. The agent's working memory IS the staging area. No write sessions, no staging in the system — the intelligence is in the agent, the system applies atomic mutations.

### CLI Commands

| Command | Type | Purpose |
|---------|------|---------|
| `ol init` | Setup | Create a knowledge system |
| `ol apply <json>` | Write | Submit a declarative mutation. One JSON = one commit. |
| `ol scope [dims...]` | Read | Navigate — structure by default, content via `--chunks` |
| `ol dims` | Read | List all dimensions with counts (lightweight, no connectivity) |
| `ol show <commit>` | Read | Show a commit's content (same JSON format) |
| `ol diff <a> <b>` | Read | Composed diff between two points (same format) |
| `ol log` | Read | Commit history (filterable by `--chunk`, `--dim`) |
| `ol branch create/switch/list` | Branch | Branching |
| `ol peer add/scope` | Read | Peer reading |

~9 commands. One write operation. The rest are reads.

**Low-level primitive commands (`dim create`, `membership set`, etc.) are not needed.** Everything is expressible as a declarative JSON mutation through `apply`.

**`--format json` is the default output.** Agents parse JSON. Human-readable via `--format human` or TTY detection. `--at <commit>` on any read command enables time travel.

### Scope Read Format

One consistent JSON structure regardless of scope depth. The default shows **structure** (dimensions, connectivity, counts). Content is opt-in via `--chunks`. Validated through concrete trace-through with a 12-chunk, 5-dimension example.

**Structural read** (`ol scope culture`):

```json
{
  "scope": ["culture"],
  "chunks": { "total": 12, "in_scope": 7, "instance": 5, "relates": 2 },
  "dimensions": [
    {
      "name": "projects",
      "shared": 5, "instance": 0, "relates": 5,
      "connections": [
        { "dim": "people", "instance": 3, "relates": 1 },
        { "dim": "education", "instance": 0, "relates": 1 }
      ],
      "edges": [
        { "dim": "finance", "instance": 3, "relates": 2 }
      ]
    },
    {
      "name": "people",
      "shared": 5, "instance": 3, "relates": 2,
      "connections": [
        { "dim": "projects", "instance": 0, "relates": 4 },
        { "dim": "education", "instance": 0, "relates": 2 }
      ]
    },
    {
      "name": "education",
      "shared": 2, "instance": 0, "relates": 2,
      "connections": [
        { "dim": "people", "instance": 2, "relates": 0 },
        { "dim": "projects", "instance": 0, "relates": 1 }
      ]
    },
    {
      "name": "partnerships",
      "shared": 1, "instance": 0, "relates": 1
    }
  ]
}
```

**With content** (`ol scope culture --chunks`): same structure, plus `chunks.items` — a flat list at the top. Each chunk appears once with full membership. Content is flat because chunks don't belong to any single dimension — they live at intersections. The browser may "duplicate" chunks by showing them under multiple dimensions, but that's a rendering decision (the human lens), not a structural one. The JSON is the system's lens — honest and non-hierarchical.

```json
{
  "scope": ["culture"],
  "chunks": {
    "total": 12, "in_scope": 7, "instance": 5, "relates": 2,
    "items": [
      {
        "id": "c3",
        "text": "Every program must create visible change within 30 days.",
        "kv": {},
        "instance": ["culture"],
        "relates": ["projects"]
      },
      {
        "id": "c10",
        "text": "Alumni-to-staff pipeline: three former participants now work here.",
        "kv": {},
        "instance": ["culture", "people"],
        "relates": ["projects"]
      },
      {
        "id": "c1",
        "text": "Maria Chen founded Sunward in 2019...",
        "kv": {"name": "Maria Chen", "role": "Executive Director"},
        "instance": ["people"],
        "relates": ["culture", "projects"]
      }
    ]
  },
  "dimensions": [ ... ]
}
```

**Empty scope** (`ol scope`): same format, `scope: []`, all dimensions listed with top-N connections. The full map.

**Key format decisions:**

- **Instance/relates visible at every level.** On the scope's chunk counts, on each connected dimension, and on connections/edges between dimensions. This is a core primitive — never withheld.
- **`instance`/`relates` on a dimension** refers to how the shared chunks relate to THAT dimension, not to the scope. Tells the agent "what kind of thing will I find if I go there?" — instances are entities, relates are topical connections.
- **Connections vs edges.** Connections = dimensions also reachable from the current scope. Edges = dimensions beyond the scope's reach, accessible through this dimension but not directly intersecting the scope. Edges are inside each dimension (not top-level) because they belong to the dimension that bridges to them.
- **Chunks are flat at the top** — not nested inside dimensions. A chunk at an intersection of 3 dimensions doesn't "belong" to any one of them. Nesting would impose a false hierarchy. The flat list with full membership is the honest representation.
- **Connections embedded per dimension** (adjacency list, not separate edge list). Duplication accepted and bounded. The agent reads one dimension entry and immediately sees its neighborhood.
- **The same format scales** from empty scope to narrow scope. Only the numbers change.

**Efficiency validated by simulation:** An agent bootstraps from zero to full structural understanding in ~3,200 tokens (6.4% of 87 chunks). Selective content reads bring the total to ~9,200 tokens (18.4%) with better understanding than reading everything blindly. The structure IS the index.

### Key Design Decisions

**No separate transaction/session concept.** The JSON mutation IS the transaction IS the commit. One JSON, one atomic commit.

**Branching is for sustained exploration.** A verified JSON mutation can go straight to main (if the culture allows). Whether agents must use branches is a culture/policy concern, not a system primitive.

**Scope returns structured JSON.** The agent reads scope results, reasons, constructs a declarative mutation. The scope output is the agent's working material; the mutation is the agent's output. No system-level preview needed.

### Open Questions (CLI)

- **Commit messages.** Is a message field on commits a new primitive? The diff itself IS the transparency — you can see exactly what changed. A message is metadata about the change, not the change itself. If stored, it's knowledge about the system's history, not the domain. If an agent needs to record its reasoning, that could live in its own peer. Whether messages belong on commits is genuinely open.
- **Partial membership updates.** Starting with full-set replacement (declarative truth). If practical use shows this is too error-prone or verbose, a partial/additive mode can be added.
- **The exact JSON format.** The structure above is illustrative. The precise schema will be settled during implementation.

## Open Hypotheses (Proposed, Not Stress-Tested)

These emerged in exploration and are worth tracking, but have not been tested enough to settle.

- **Dimensions can be `instance` of other dimensions.** Proposed as the mechanism for how the browser shows "members" vs "connections" at any scope — a project is `instance` of `projects`; `projects` is `instance` of `collections`. Plausible, but not tested. May open new problems.
- **Chunks relate only to direct dimensions — no propagation to parents.** If dimensions can be instances of other dimensions, the question is whether membership propagates upward. Proposed: no. A chunk knows only its direct dimensional membership; parent-level aggregates are computed, not stored. Follows from the above; not independently tested.
- **Dimension-level connectivity is computed from chunk aggregates.** The relatedness between two dimensions at a given scope is derived from shared chunks, not stored directly. Consistent with binary membership — no stored numbers, only structural computation.
- **Chunk IDs are implied by the commit primitive.** If every mutation is a commit, chunk identity can be derived from the commit history rather than requiring a separate ID field. Logical consequence of the commit model. Not yet confirmed or stress-tested.
- **Qualitative weight gradients.** If binary `relates` proves insufficient in practice, low/mid/high levels may be added. Deferred — start with binary, add gradients only when practical needs demonstrate they're necessary.

## Open Questions

- **Meta-chunks.** Currently: a chunk on exactly one dimension, used as a stable anchor for that dimension's meaning. The question was raised: if the dimension IS the group, is the meta-chunk concept still needed? The anchoring function hasn't been replaced by anything. Open — do not discard yet.
- **Views mechanics.** Approved views, drift detection, view testing — the concept is there, exact mechanics not settled.
