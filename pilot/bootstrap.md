# Bootstrap

One `apply()` call. Chunks with user-supplied IDs, processed sequentially — later chunks reference earlier ones. The full seed in one atomic commit:

1. Root scopes: `agent`, `ui`
2. `session` archetype on `agent`
3. Session event types on `agent` (instance) and `session` (relates): `prompt`, `answer`, `tool-call`, `tool-result`, `context`
4. `invocable` archetype on `agent`: `{ required: ["executable"] }`
5. `dispatch` archetype on `agent`: `{ propagate: true, accepts: ["read-boundary", "write-boundary"] }`
6. `read-boundary` and `write-boundary` on `agent` (relates to `dispatch`)
7. IO invocables on `agent` (instances of `invocable`): `filesystem`, `shell`, `web` — each with `propagate: true, accepts: [type]`, intrinsic boundaries (read/write limited to own dispatch scope), and accepted type definitions with `required` fields and `body.schema` for API tool generation
8. `claude` on `agent` (instance of `invocable`): `{ propagate: true, ordered: true, accepts: ["session", "context", "prompt"] }`, with type refs on `claude` as relates. Intrinsic boundaries: wide open (defers to dispatch).
9. `split` and `leaf` on `ui`
10. `view-root` (instance of `leaf`) on `ui`
11. `scope-history` on `ui`

**First run.** The database is bootstrapped. The initial view-root is a single empty leaf. The command palette opens — the user's first action is to select a scope.
