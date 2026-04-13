# Bootstrap

Three `apply()` calls — one per root scope, simulating three peers. Engine and UI chunks come first, as if mounted from external databases. Agent chunks come last, referencing engine contracts by placing instances on them.

## Commit 1: Engine

Runtime contracts and primitives. In a peered system these come from the engine's own database.

1. `engine` — root scope
2. `invocable` archetype on `engine`: `{ required: ["executable"] }`
3. `dispatch` archetype on `engine`: `{ propagate: true, accepts: ["read-boundary", "write-boundary"] }`
4. `read-boundary` and `write-boundary` on `engine` (instance) and `dispatch` (relates)

## Commit 2: UI

Tiling primitives. In a peered system these come from the UI module's own database.

1. `ui` — root scope
2. `split` on `ui`: `{ ordered: true }`
3. `leaf` on `ui`
4. `view-root` on `ui` (instance of `leaf`) — initial empty tile
5. `scope-history` on `ui`

## Commit 3: Agent

Project tools and abstractions. References engine contracts across the peer boundary.

1. `agent` — root scope
2. `session` archetype on `agent`: `{ ordered: true, accepts: ["prompt", "answer", "tool-call", "tool-result", "context"] }`
3. Session event types on `agent` (instance) and `session` (relates): `prompt`, `answer`, `tool-call`, `tool-result`, `context`
4. IO invocables on `agent` (instance) and `invocable` (instance): `filesystem`, `shell`, `web` — each with `propagate: true, accepts: [type]`, intrinsic boundaries (read/write limited to own dispatch scope), and accepted type definitions with `required` fields and `body.schema` for API tool generation
5. `claude` on `agent` (instance) and `invocable` (instance): `{ propagate: true, ordered: true, accepts: ["session", "context", "prompt"] }`, with `session`, `context`, `prompt` as relates on `claude`. Intrinsic boundaries: wide open (defers to dispatch).

**First run.** The database is bootstrapped. The initial view-root is a single empty leaf. The command palette opens — the user's first action is to select a scope.
