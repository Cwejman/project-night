# Engine Spec Stress Test

Findings from stress-testing the engine, boundary, protocol, spec composition, and VM/lifecycle specs against the implemented substrate lib. Three rounds: structural findings, implementation-readiness gaps, and review corrections.

Items marked **resolved** were addressed in spec updates. Items marked **dismissed** were misidentified or outside scope.

---

## Part 1: Structural Findings

### 1. Placement ordering breaks dual placement on `accepts` scopes — RESOLVED (spec), code pending

When the agent creates a prompt chunk and places it on `my-session` (instance, seq:5) AND on `prompt` (instance), the order matters. `apply.ts` processes placements sequentially. If the session placement comes first, `enforce()` checks `isInstanceOf(chunk, prompt_type_id)` — but that placement hasn't been written yet. Spec check fails.

**Resolution:** `substrate.md` now specifies two-pass enforcement: write all placements first, enforce all second. `apply.ts` must be updated to match.

### 2. Boundary hierarchy — flat vs. recursive is undefined — RESOLVED

**Resolution:** `engine.md` now specifies boundaries are transitive via instance chains. A boundary root `[agent]` grants access to everything reachable by walking instance placements upward.

### 3. Nested dispatch boundaries produce empty intersections — RESOLVED

**Resolution:** `engine.md` now specifies the dispatch scope is always accessible as a structural invariant.

### 4. `seq` auto-assignment is specced but not implemented — code pending

The substrate spec says "Auto-assigned on append if omitted." `apply.ts` passes `null` when seq is missing — no auto-increment logic. The agent depends on this for ordered session events.

**Resolution:** Listed in `substrate.md` "What's Open." Implement in `apply.ts`: if `ordered: true` and `seq` is null on an instance placement, set `seq = max(existing seq on scope) + 1`.

### 5. Boundary chunk placement mechanics — RESOLVED

Concrete dispatch creation `Declaration` added to `engine.md`. Shows the three things the engine builds: dispatch chunk (dual instance), boundary containers (new per-dispatch, scope references by identity), argument chunks (passed through from UI). Uses a `filesystem` dispatch as the example — the engine is invocable-agnostic.

### ~~6. Protected chunk enforcement~~ — DISMISSED

The engine mediates all invocable writes through the protocol. It can simply reject `apply` requests that reference the dispatch chunk ID or boundary chunk IDs before passing through to the lib. Straightforward engine-level filtering — no special lib mechanism needed.

### 7. "Open" boundary (no intrinsic boundary) has no structural representation — RESOLVED

**Resolution:** `engine.md` now specifies: "An invocable with no intrinsic boundary is treated as the universal set — intersection with anything yields the other set."

### ~~8. `await` mechanism~~ — DISMISSED

Implementation detail, not a spec gap. Use whatever orchestrates best in TypeScript and expose a clean SDK for the invocable client. The protocol contract is clear — the implementation chooses the concurrency primitive.

### 9. `accepts` ambiguity rule not enforced — code pending

Substrate spec says a chunk can't be instance of two types in the same `accepts` list. `spec.ts` uses `some()` — finds first match, never checks for multiple. A dual-typed chunk would silently break the agent's session-to-API-message mapping.

### ~~10. Who generates tool definitions~~ — DISMISSED

The agent invocable owns all model-API-specific logic: mapping invocable chunks to Anthropic tool schemas, and mapping tool_use responses back to dispatches. The engine doesn't know about model APIs. This is agent-level logic, built when implementing the agent invocable after engine and UI are in place.

### 11. VM lifecycle — RESOLVED

The engine is responsible for creating and managing the VM. The UI imports the engine as a library — on SvelteKit startup, the UI calls the engine to bootstrap (which starts the VM). On app exit, the UI calls the engine to clean up.

### 15. Dead code — type-definition bypass in spec.ts — code pending

Line 172 of `spec.ts` checks if a chunk IS one of the accepted types. This can never trigger because type definitions use `relates` (which skips enforcement entirely). Harmless but misleading. Remove.

### 16. Name uniqueness per scope not enforced — code pending

`substrate.md` says names are unique within their parent scope, but neither `apply.ts` nor `spec.ts` enforces this. `resolveNameInScope` (used by spec enforcement for `accepts` resolution) returns the first match — arbitrary if there are duplicates. The UI would show duplicate names with no way to distinguish them. Without enforcement, the name system degrades silently.

**Resolution:** Enforce in `apply.ts`: when processing a placement, if the chunk has a name, check that no other chunk already placed on that scope has the same name. Write-time check like the other spec enforcements.

### 17. Intra-declaration chunk references need pre-generated IDs — documentation pending

When a single `apply()` creates multiple new chunks that reference each other (e.g., a dispatch chunk and its boundary containers), the caller must pre-generate IDs so placements can reference them. `apply.ts` accepts provided IDs: `const chunkId = entry.id ?? generateId()`. The bootstrap uses this pattern with human-readable IDs. The engine uses it with `generateId()` before building the declaration.

This pattern is not documented. The `id` field on `ChunkDeclaration` is typed as optional, suggesting "let the system generate it." The pre-generate pattern for intra-declaration references should be explicit in the `ol` lib's API contract — either documented or exposed as a utility.

---

## Part 2: Implementation-Readiness Gaps

Second pass focused on what an implementer needs to one-shot the engine. The spec covered the protocol schema, dispatch structure, boundary semantics, and invocable model well. What was missing was the engine's own API surface and operational behavior.

### A. Concrete dispatch creation declaration — ADDED to engine.md, then CORRECTED

Initially showed a claude-specific example with session/context/prompt hardcoded — conflated the engine with the agent invocable. Corrected to show a `filesystem` dispatch. The engine is invocable-agnostic: it creates the dispatch chunk, builds boundary containers, and places argument chunks passed through from the UI. The substrate's spec enforcement validates the composed contract. The engine doesn't interpret or type-check the arguments itself.

The declaration example uses pre-generated IDs (see finding 17) so chunks can reference each other within the same `apply()`.

### B. Engine public API surface — ADDED to engine.md, then CORRECTED

Initially had a `DispatchArgs` type with claude-specific fields (session, context, prompt). Corrected to be invocable-agnostic: `chunks: ChunkDeclaration[]` (whatever the UI assembled) + `readBoundary: string[]` + `writeBoundary: string[]`. Four functions: `bootstrap`, `dispatch`, `cancel`, `shutdown`. The UI reads the substrate directly for all read operations.

### C. Timeout — RESOLVED

The `dispatch` function takes an explicit optional `timeout` in ms. The engine writes it to the dispatch body as `timeout_ms` — an engine-owned field alongside status, pid, started. Defaults to the invocable chunk's `body.timeout_ms` if not provided. No new chunks or types needed. The dispatch body is already engine territory, so scalar dispatch configuration lives there naturally.

### D. Await semantics — clarified, no spec change needed

`dispatch` is always asynchronous — returns a dispatch ID immediately. The invocable decides how to compose: sequential await, parallel await (multiple IDs), fire-and-forget. The client SDK provides `dispatch()` and `await()` as primitives; the invocable composes them however it wants.

`await` waits for all listed dispatches to reach terminal state (completed or failed). A completed dispatch returns the `ScopeResult` from scoping into its dispatch chunk — the chunks the invocable placed on its own dispatch scope are the results. A failed dispatch returns an error entry in the result map.

### E. Error handling — ADDED to engine.md

Full error condition → outcome table added to Operational Behavior section. Key distinction: boundary violations, spec violations, and invalid requests return error responses (process continues). Malformed JSON, crashes, and timeouts are terminal (process killed or dead, status set to failed).

### F. Startup reconciliation — ADDED to engine.md

On bootstrap, query all dispatches with status pending/running, set to failed with `body.error: "engine restart"`.

### G. Traceability — RESOLVED

Commits stay in their own table — single source of truth, inherently tamper-proof because `apply()` can't touch them. The read layer synthesizes them as ChunkItems when scoping into a dispatch or a chunk.

- Scope into a dispatch → `scope()` queries commits where `dispatch_id` matches, returns as synthetic ChunkItems.
- Scope into any chunk → `scope()` queries `chunk_versions` to find commits that touched it, returns as synthetic ChunkItems.
- Intersection works naturally.

The data already exists in `chunk_versions`. The only schema change: a `dispatch_id` column on `commits`, set by the engine when executing applies on behalf of invocables. No placement inflation, no circularity, no special protection rules. Commits look like chunks to every reader but are structurally separate.

**Implementation:**
- `commits` table: add `dispatch_id TEXT` column
- `apply()`: accept optional `{ dispatch?: string }`, write it to the commit row
- `scope()`: extend to synthesize commit ChunkItems from commits/chunk_versions when relevant

### H. VM lifecycle — ADDED to engine.md

VM is always used — containment is architectural, not optional. Engine starts VM on bootstrap, stops on shutdown. All invocables share one VM instance. For testing the engine protocol in isolation, a test harness can spawn mock invocables as local subprocesses — same pipe, same protocol. This is for engine development only, not a runtime mode.

### I. Boundary request behavior — ADDED to engine.md

When any queried scope is not reachable from boundary roots, return `BOUNDARY_VIOLATION`. Explicit and debuggable — the invocable knows it asked for something outside its boundary rather than thinking the scope is empty.

---

## Summary

### Code changes needed before engine implementation — ALL DONE

- ~~`apply.ts`: two-pass enforcement (write all placements, then enforce all)~~
- ~~`apply.ts`: seq auto-assignment for ordered scopes~~
- ~~`apply.ts`: name uniqueness enforcement per scope~~
- ~~`spec.ts`: accepts ambiguity rejection (count matches, reject if > 1)~~
- ~~`spec.ts`: remove dead type-definition bypass~~
- ~~`db.ts`: add `dispatch_id TEXT` column to `commits` table~~
- ~~`apply.ts`: accept optional `{ dispatch?: string }` parameter, write to commit row~~
- ~~`read.ts`: commit projection via virtual `COMMITS_SCOPE` (`'__commits'`)~~ — fully synthetic, no real chunks or placements. `scope(db, [COMMITS_SCOPE])` returns all commits as ChunkItems. Intersection with a dispatch ID filters by `dispatch_id`. Intersection with a chunk ID filters by `chunk_versions`.
- `ol` lib: pre-generate-IDs pattern documented by usage in bootstrap.ts and engine.md dispatch example

### Open design questions

None remaining. All items resolved or have clear implementation paths.

### Resolved in engine.md

| Item | Status |
|------|--------|
| A — Dispatch creation declaration | Added (filesystem example, invocable-agnostic) |
| B — Engine public API surface | Added (generic DispatchArgs with ChunkDeclaration[]) |
| C — Timeout | Resolved (dispatch arg, defaults to invocable body) |
| D — Await semantics | Clarified (async by nature, invocable composes) |
| E — Error handling | Added (error vs. kill table) |
| F — Startup reconciliation | Added |
| G — Traceability | Resolved (commits table + dispatch_id column, scope() synthesizes as ChunkItems) |
| H — VM lifecycle | Added (always VM, test harness for protocol dev) |
| I — Boundary request behavior | Added (BOUNDARY_VIOLATION) |
