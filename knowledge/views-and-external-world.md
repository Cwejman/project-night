# Views and External World

## Views (Explored, Not Fully Settled)

A **view** is a scope + display settings → produces a result. A saved query with a rendering contract.

### Types

- **Ephemeral** — a browser session, a one-time query. Not saved.
- **Saved** — a named view with specific scope + display settings. Reusable.
- **Approved** — a human has reviewed and confirmed the output. Creates a dependency.

### Views as Dependency Tracking

When the system connects to the external world, approved views matter. A website page with human-approved phrasing is a frozen dependency. If the knowledge changes in a way that would alter the view's output, the system should flag it — drift detection.

This is also how the browser's own contracts work. The browser depends on the knowledge structure. Views and view testing/enforcing are the contracts between the browser and the structure. If the structure changes in a way that breaks a view, that's detectable.

### Views with Reverse Testing

An approved view carries an implicit assertion: "this view should produce this result." That's reverse testing — the view tests the system. Safety in an evolving system.

### The Website as Browser

The ideal: a website IS a browser with specific scope + display per page.

- A "projects page" is scope `{projects}` with grouping/sorting settings
- An "about page" is scope `{organization, identity}` with a narrative template

Earlier iterations: generate a static website from the knowledge base. Later: live browser wrapper with fixed view parameters. The knowledge system doesn't change; the scope changes what's visible.

## External Content — Resolved Via Integrations

External content (code, images, APIs, media) is handled through integration chunks. See `integrations-and-history.md`. A reference is a chunk with key/value fields containing resolution parameters. The integration contract (also a chunk) tells agents and browser how to resolve it.

The knowledge system is the source of truth for meaning and relationships. External content is referenced, not stored. The agent resolves references using contracts; the browser renders them using its UI implementations per integration type.

## The Build Sequence (Software)

Three pieces, all git-based:

1. **CLI** — primary interface. Agents use this. Read, write, query, manage chunks and dimensions. Preferred over MCP.
2. **Browser** — TUI first, then web. Navigating the dimensional space. Depends on the knowledge structure. Has UI implementations per integration type.
3. **Claude plugin** — later priority. Initially use Claude's existing session capability with deliberate interactions through the CLI.

## What's Still Open

- Exact mechanics of approved views and drift detection.
- View composition — can a view reference other views?
- Display settings vocabulary — what does the browser need to know per view?
- The website-as-browser progression: static generation → incremental → hybrid → live.
