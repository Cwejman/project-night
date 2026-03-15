# Browser User Story — Navigating the Knowledge Space

## The Model (Primitives)

- A **chunk** is a unit of meaning with weight on one or more dimensions.
- A **dimension** is a named phenomenon. No rigid schema — just a name and whatever chunks have weight on it.
- A **meta-chunk** is a chunk with weight on exactly one dimension. Stable anchor for that dimension's meaning.
- **Dimensions connect through shared chunks.** No chunk-to-chunk relations without a dimension.
- **Historical relationships** (chunk splits, weight changes, temporal order) live in the atomic event history, not modeled as dimensions.
- **Generated summaries** are computed for the browser, not stored in the DB. Can be precomputed for static browsing. Not source of truth.

## Scope

The browser's state is a **scope** — a set of dimensions currently active. The multi-dimensional address of where you are.

- `{}` — empty, see all dimensions
- `{culture}` — see what relates to culture
- `{culture, breathing}` — narrower intersection

**Navigation is free.** Add or remove any dimension at any point. The view updates:

- **Add a dimension** → scope narrows, fewer chunks match, some connections disappear
- **Remove a dimension** → scope widens, more chunks match, new connections appear

**Empty scopes are valid.** If an intersection has no chunks, the browser shows adjacency — what you'd see if you dropped one dimension. These edges show where the knowledge is and how to reach it. Creating something at an empty intersection is also valid.

**Pre-scoped entry.** An agent bootstraps with a specific scope. A website generator enters with its own. The scope IS the query.

## What You See

**You primarily see dimensions, not chunks.** The browser is a space navigator. At any scope:

1. A generated summary of the current scope
2. Related dimensions reachable from here — each with summary and connection strength
3. The ability to peek and ask questions before adding/removing dimensions

**Chunks are what you read when narrowed enough.** Broad scope = navigate by dimensions and summaries. Narrow scope = read actual content. When many chunks exist at a scope, they group by their dimensional weight differences — effectively sub-dimensions to navigate further.

## Walkthrough

### Empty scope `{}`

All dimensions visible with generated summaries:

```
  culture         — "The approach: unbound by context, cyclically integrated..."
  architecture    — "How the system is structured..."
  breathing       — "The cyclical rhythm of knowledge exchange..."
  identity        — "The system IS the agent..."
  implementation  — "Scripts, hooks, code muscles..."
  lore            — "Evolutionary depth, sessions, explorations..."
```

### Add "culture" — Scope `{culture}`

Summary of culture appears. Connected dimensions with strength:

```
  identity     ●●●●●  — "The system IS the agent..."
  breathing    ●●●●○  — "The cyclical rhythm..."
  lossless     ●●●○○  — "Nothing knowledge-worthy is lost..."
  session      ●●●○○  — "Disposable compute surface..."
  bootstrap    ●●○○○  — "The act of becoming..."
  write-first  ●●○○○  — "Persist before acknowledging..."
```

Hovering any dimension shows a summary *as seen from the current scope*.

### Add "breathing" — Scope `{culture, breathing}`

Narrows. Connected dimensions from this intersection:

```
  agent-cycle  ●●●○○
  identity     ●●○○○
  session      ●●○○○
```

Implementation not visible from here.

### Curiosity about implementation

Options from `{culture, breathing}`:

- Add implementation → `{culture, breathing, implementation}`. Probably empty. Browser shows: "drop culture → 2 chunks, drop breathing → 3 chunks, drop implementation → 8 chunks."
- Remove culture, add implementation → `{breathing, implementation}`. 2 chunks about how bootstrap.js performs the inhale.
- Remove breathing, add implementation → `{culture, implementation}`. 3 chunks about how culture manifests in code.

Each path is a choice. The browser shows consequences before committing.

### Reading chunks (narrowed enough)

At narrow scope, expand to see actual chunks:

```
  ▸ [meta] "The approach: unbound by context, replacing the cycle of..."
  ▸ "The session is disposable. The knowledge is the agent."
      also: identity ●●●●, session ●●●
  ▸ "The breathing metaphor..."
      also: breathing ●●●●, agent-cycle ●●●
```

Each chunk's other dimensions are pathways to follow.

### Pre-scoped entry

Agent enters with `{culture, claude-integration}` → operational knowledge only.
Website generator enters with `{portfolio, projects}` → generates pages.
The system doesn't change. The scope does.

## TUI Approach (Initial Ideas — Details Deferred)

List-based. Each dimension in scope shown with: name, weight, short summary, primary connected dimensions. Colors denote shared sub-dimensions across list items — visual cross-connection tracking. Strong outliers (connections to outside scope) visually distinct. Many more ideas to explore on TUI — parked for now.

## Properties

- No hierarchy in storage. Views are generated from scope.
- Scope is the query. Multi-dimensional, composable, freely manipulable.
- Empty scopes show adjacency.
- Chunks group by weight differentiation.
- Meta-chunks anchor dimensions.
- Summaries are ephemeral. Precomputable, never in the DB.
- History is in the event stream.
- Any reader, any interface.
