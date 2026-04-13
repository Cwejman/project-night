# Engine

The engine sits between the substrate library and everything that dispatches. It is the authority on dispatch creation, boundary enforcement, invocable lifecycle, and VM management. The UI calls the engine. Invocables call the engine. Nothing reaches the database without going through the lib — and nothing dispatches without going through the engine.

The engine is a TypeScript module imported directly by the UI's server functions — the interface is function calls, not a protocol. The JSON lines protocol is only for VM invocables communicating back through the pipe.

## What the Engine Owns

- **Dispatch creation.** Creates the dispatch chunk, validates the contract (all accepted types present), records it as instance of the invocable and `dispatch`. One atomic `apply()`. The dispatch chunk is engine-owned — invocables cannot modify it.
- **Boundary enforcement.** Computes the effective boundary by intersecting the invocable's intrinsic boundaries with the dispatch's boundaries. Filters all scope/search results against the effective read boundary. Rejects any apply that touches a scope outside the effective write boundary.
- **Invocable protocol.** Exposes an API that invocables in the VM call to interact with the substrate. The invocable sends requests (scope, search, apply, dispatch, await). The engine validates each request against the dispatch's boundaries and executes via the lib.
- **VM management.** Starts/stops the VM. Mounts invocable code read-only. Manages network policy (public internet allowed, local network blocked).
- **Process lifecycle.** Spawns invocable processes inside the VM. Tracks PID, status (running/completed/failed), start time. Kills on timeout or user request. Updates the dispatch chunk on completion. The engine owns the status state machine: `pending → running → completed/failed`. The engine sets `pending` on creation, `running` on spawn, and `completed` (exit 0) or `failed` (non-zero exit) on process exit. Status is a body field on the dispatch chunk, updated via `apply()`. The invocable does not set its own status — it simply exits.
- **Tool-call dispatch.** When an agent invocable requests a tool call, the engine creates a dispatch for the target invocable, spawns it, and returns the dispatch chunk ID. The agent decides when to await. Same dispatch mechanics as any invocation. The tool dispatch's boundaries are the intersection of the parent dispatch's boundaries and the target invocable's intrinsic boundaries — the engine computes this at dispatch creation.

## Engine API

The engine is a TypeScript module imported by the UI's server functions. These are the exported functions — the contract between the engine and the UI.

```typescript
import type { Db } from '../ol/src/db'
import type { ChunkDeclaration } from '../ol/src/types'

type Engine = {
  /** The substrate database. The engine holds the reference. */
  db: Db
}

type DispatchArgs = {
  /** Chunks to place on the dispatch, as assembled by the UI from the dispatch tile.
      The engine does not interpret these — it places them on the dispatch chunk
      and the substrate's spec enforcement validates the contract. */
  chunks: ChunkDeclaration[]
  /** Scope IDs for the read boundary */
  readBoundary: string[]
  /** Scope IDs for the write boundary */
  writeBoundary: string[]
  /** Timeout in ms. Defaults to invocable's body.timeout_ms if not provided. */
  timeout?: number
}

type DispatchResult = {
  /** The dispatch chunk ID */
  dispatchId: string
}

/**
 * Initialize the engine. Opens the database, starts the VM,
 * reconciles stuck dispatches from a previous session.
 */
function bootstrap(dbPath: string): Engine

/**
 * Create a dispatch. The engine creates the dispatch chunk (instance of
 * the invocable and dispatch archetype), places the argument chunks and
 * boundary containers on it, validates via apply(), and spawns the
 * invocable in the VM. Returns immediately — the invocable runs
 * asynchronously.
 */
function dispatch(engine: Engine, invocableId: string, args: DispatchArgs): DispatchResult

/**
 * Cancel a running dispatch. Kills the invocable process,
 * sets status to "failed".
 */
function cancel(engine: Engine, dispatchId: string): void

/**
 * Shut down the engine. Kills all running invocables, stops the VM.
 */
function shutdown(engine: Engine): void
```

The engine is invocable-agnostic. `DispatchArgs.chunks` are the argument chunks the UI assembled from the dispatch tile's input modules — whatever the invocable's composed spec accepts. The engine doesn't interpret them. It creates the dispatch chunk, places the arguments on it, builds boundary containers from `readBoundary`/`writeBoundary` scope IDs, and calls `apply()`. The substrate's spec enforcement validates that the arguments match the invocable's contract.

The UI reads the substrate directly (via the `ol` lib) for all read operations — scope, search, log. The engine is only called for dispatch, cancel, and lifecycle. The UI does not go through the engine for reads.

## Invocable Protocol

The invocable runs in the VM with no direct database access. It communicates with the engine over **stdin/stdout pipes**.

**Transport.** The engine spawns the invocable inside the VM via the VM CLI:

```
Bun.spawn(['limactl', 'shell', instance, '--', './invocables/claude', dispatchId])
```

OrbStack equivalent: `orb exec <machine> ./invocables/claude <dispatchId>`. Both pipe stdin/stdout to the host process. The engine owns both ends. No server, no port, no filesystem coordination.

**Protocol.** JSON lines — one JSON object per line. The invocable writes requests to stdout, reads responses from stdin. Stderr is for logging (forwarded to the engine's log).

**Operations available to invocables:**

| Operation | Description |
|---|---|
| `scope` | Read scope, filtered by read boundary. External connections visible (names, counts) but not readable. |
| `search` | Full-text search, filtered by read boundary |
| `apply` | Write, checked against write boundary |
| `dispatch` | Dispatch another invocable. Returns dispatch chunk ID immediately. |
| `await` | Block until one or more dispatches complete. Returns results. |

The invocable receives its dispatch ID as a command-line argument.

### Protocol Schema

Every request has an `op` field and an `id` field (monotonic integer, for correlation). Every response has the matching `id` and either `result` or `error`.

**Requests:**

```jsonl
{"id":1,"op":"scope","scopes":["chunk_abc","chunk_def"]}
{"id":2,"op":"search","query":"deployment config"}
{"id":3,"op":"apply","declaration":{"chunks":[...]}}
{"id":4,"op":"dispatch","invocable":"filesystem","args":{"operation":"read","path":"/src/main.ts"}}
{"id":5,"op":"await","dispatches":["d_1","d_2","d_3"]}
```

**Responses:**

| Op | Result type | Description |
|---|---|---|
| `scope` | `ScopeResult` | Scope chunks, items, connected scopes |
| `search` | `ChunkItem[]` | Matching chunks |
| `apply` | `ApplyResult` | Commit + created chunk IDs |
| `dispatch` | `{ dispatch: string }` | The dispatch chunk ID, returned immediately |
| `await` | `Record<string, ScopeResult>` | Map of dispatch ID → result (scope of completed dispatch) |

```jsonl
{"id":1,"result":{"scope":[...],"head":"c_99","chunks":{"total":12,"in_scope":12,"instance":10,"relates":2,"items":[...]},"connected":[...]}}
{"id":4,"result":{"dispatch":"d_abc123"}}
{"id":5,"result":{"d_1":{"scope":[...],...},"d_2":{"scope":[...],...},"d_3":{"scope":[...],...}}}
```

**Errors:**

```jsonl
{"id":3,"error":{"code":"BOUNDARY_VIOLATION","message":"Write rejected: scope xyz is outside write boundary"}}
```

| Code | Meaning |
|---|---|
| `BOUNDARY_VIOLATION` | Read or write outside effective boundary |
| `VALIDATION_ERROR` | Declaration fails spec validation |
| `NOT_FOUND` | Referenced chunk or invocable does not exist |
| `DISPATCH_FAILED` | Dispatched invocable exited non-zero |
| `INVALID_REQUEST` | Malformed JSON, unknown op, missing fields |

Types are identical to the substrate library (`ol/src/types.ts`): `Declaration`, `ScopeResult`, `ChunkItem`, `ApplyResult`.

### Dispatch and Await

`dispatch` and `await` are separate operations. `dispatch` creates the dispatch chunk, spawns the invocable, and returns the dispatch chunk ID immediately. The invocable is running — its writes accumulate in the substrate. `await` takes one or more dispatch IDs and blocks until all complete, then returns each dispatch's result as a `ScopeResult`.

This separation matters because there is no difference between spawning an agent and doing a tool call — both are invocables. A tool call returns in milliseconds. A sub-agent might run for minutes. The protocol handles both identically:

**Sequential tool call (pilot agent loop):**
```
→ {"id":1,"op":"dispatch","invocable":"filesystem","args":{...}}
← {"id":1,"result":{"dispatch":"d_1"}}
→ {"id":2,"op":"await","dispatches":["d_1"]}
← {"id":2,"result":{"d_1":{...scope result...}}}
```

**Parallel tool calls (model returns multiple tool_use):**
```
→ {"id":1,"op":"dispatch","invocable":"filesystem","args":{...}}
← {"id":1,"result":{"dispatch":"d_1"}}
→ {"id":2,"op":"dispatch","invocable":"shell","args":{...}}
← {"id":2,"result":{"dispatch":"d_2"}}
→ {"id":3,"op":"dispatch","invocable":"web","args":{...}}
← {"id":3,"result":{"dispatch":"d_3"}}
→ {"id":4,"op":"await","dispatches":["d_1","d_2","d_3"]}
← {"id":4,"result":{"d_1":{...},"d_2":{...},"d_3":{...}}}
```

**Fire-and-forget (background agent):**
```
→ {"id":1,"op":"dispatch","invocable":"claude","args":{...}}
← {"id":1,"result":{"dispatch":"d_sub"}}
... invocable continues its own work ...
→ {"id":5,"op":"await","dispatches":["d_sub"]}  (later, when it needs the result)
```

The dispatch chunk exists in the substrate immediately. Any code with read access can scope into a running dispatch to observe its state.

**Client library.** The engine exports a client module (`engine/client.ts`) that wraps the protocol — typed functions (scope, search, apply, dispatch, await) over stdin/stdout serialization. Invocables import the client, not raw IO. Same types as the substrate lib, same API shape. The engine and client are two halves of one contract.

**Testing without VM.** The protocol is stdin/stdout — the VM adds containment, not functionality. For development and TDD, the engine spawns invocables as local subprocesses on the host. Same pipe, same protocol, no VM overhead. The full cycle (dispatch creation → invocable spawn → protocol communication → boundary enforcement → completion) is testable entirely on the host.

## Invocables

An invocable is a chunk with an executable in its body — an instance of the `invocable` archetype (`spec: { required: ["executable"] }`). The `invocable` archetype lives in the `engine` root scope. Actual invocable chunks (filesystem, shell, web, claude) live in the `agent` root scope as project tools — they are instances of the engine's `invocable` contract. The UI discovers invocables by scoping into `invocable`. All invocables run in the VM. The engine spawns them all via the same pipe mechanism — some return fast (filesystem read), some are long-running (agent loop). The containment model is the same.

### Dispatch

A dispatch is a chunk that records an invocation. Every dispatch is an instance of both its invocable and the `dispatch` base archetype. The invocable carries its specific contract. The `dispatch` archetype carries the universal contract. Both use `propagate: true`, so the substrate composes them by union onto the dispatch instance.

**The dispatch chunk is engine-owned.** The engine creates it, sets its status, updates it on completion. Invocables cannot modify the dispatch chunk itself or the boundary chunks placed on it — these are the invocation's structural contract, set before spawn, immutable after.

**The `dispatch` archetype:**

```
dispatch
  spec: { propagate: true, accepts: ["read-boundary", "write-boundary"] }
```

**Dispatch body fields** (written by the engine, not in `required` on the archetype — propagate means the spec applies to children, not to dispatches themselves):

```
body: { status: "pending"|"running"|"completed"|"failed", pid: number, started: ISO string, timeout_ms: number }
```

**An invocable (e.g. claude):**

```
claude (instance of invocable)
  spec: { propagate: true, ordered: true, accepts: ["session", "context", "prompt"] }
  body: { executable: "./invocables/claude" }
  relates: session, context, prompt
```

**Effective contract on a claude dispatch:**

```
ordered: true
accepts: ["session", "context", "prompt", "read-boundary", "write-boundary"]
```

The UI reads both archetypes' specs, resolves each accepted type, and generates the input surface from the type's own spec:

- `session` — scope selector
- `context` (`ordered: true`) — ordered scope-list builder
- `prompt` — text input
- `read-boundary` — scope-set builder
- `write-boundary` — scope-set builder

All inferred. No custom dispatch UI.

**Dispatch flow:**

1. User assembles dispatch arguments in the UI
2. UI calls the engine with the invocable ID and arguments
3. Engine creates the dispatch chunk (one `apply()`), validates the contract
4. Engine spawns the invocable in the VM, passing dispatch ID
5. Invocable communicates with engine via protocol
6. On completion, engine updates dispatch status

**Dispatch creation declaration.** The engine constructs a single `apply()` that creates the dispatch chunk and places all arguments. The engine builds three things: the dispatch chunk itself, the boundary containers, and the argument placements. The argument chunks come from the UI — the engine places them on the dispatch without interpreting them. The substrate's spec enforcement validates the composed contract.

The engine pre-generates IDs so chunks created in the same `apply()` can reference each other via placements. It resolves existing chunks by ID (looked up via scope queries before building the declaration).

Example — dispatching `filesystem` with an `fs-command` argument and boundaries:

```typescript
import { generateId } from '../ol/src/id'

// Pre-generate IDs for new chunks that need intra-declaration references
const dispatchId = generateId()
const rbId = generateId()
const wbId = generateId()

// Resolve existing chunk IDs via scope queries before building the declaration.
// The engine looks up the invocable, dispatch archetype, boundary types, and
// boundary scope references by scoping into the relevant scopes and reading IDs.
// Here shown as constants for clarity:
const filesystemId = '...'    // looked up: instance of invocable named "filesystem"
const dispatchTypeId = '...'  // looked up: instance of engine named "dispatch"
const readBoundaryId = '...'  // looked up: instance of engine named "read-boundary"
const writeBoundaryId = '...' // looked up: instance of engine named "write-boundary"
const fsCommandId = '...'     // looked up: relates on filesystem named "fs-command"
const agentScopeId = '...'    // looked up: boundary scope the user selected

apply(db, {
  chunks: [
    // 1. The dispatch chunk — engine creates this for every dispatch.
    //    Instance of both the target invocable and the dispatch archetype.
    {
      id: dispatchId,
      body: { status: 'pending' },
      placements: [
        { scope_id: filesystemId, type: 'instance' },
        { scope_id: dispatchTypeId, type: 'instance' },
      ],
    },

    // 2. Boundary containers — engine creates these from readBoundary/writeBoundary.
    //    New chunks per dispatch. Scope references placed on them by identity.
    {
      id: rbId,
      placements: [
        { scope_id: readBoundaryId, type: 'instance' },
        { scope_id: dispatchId, type: 'instance' },
      ],
    },
    { id: agentScopeId, placements: [{ scope_id: rbId, type: 'instance' }] },

    {
      id: wbId,
      placements: [
        { scope_id: writeBoundaryId, type: 'instance' },
        { scope_id: dispatchId, type: 'instance' },
      ],
    },
    { id: agentScopeId, placements: [{ scope_id: wbId, type: 'instance' }] },

    // 3. Argument chunks — passed through from the UI (args.chunks).
    //    The engine adds a placement on the dispatch to each.
    //    Spec enforcement validates the composed contract.
    {
      body: { operation: 'read', path: '/src/main.ts' },
      placements: [
        { scope_id: fsCommandId, type: 'instance' },
        { scope_id: dispatchId, type: 'instance' },
      ],
    },
  ],
})
```

The composed spec on this dispatch's children comes from `filesystem` (`propagate: true, accepts: ["fs-command"]`) and `dispatch` (`propagate: true, accepts: ["read-boundary", "write-boundary"]`). Union: `accepts: ["fs-command", "read-boundary", "write-boundary"]`. Every child must be instance of one of those types. The boundary container is instance of `read-boundary` — passes. The argument chunk is instance of `fs-command` — passes. The substrate validates; the engine doesn't check types itself.

The boundary containers are new chunks created per dispatch. The scope references placed on them ARE the boundary roots by identity — existing scope chunks placed as instances. The engine reads the boundary by scoping into the container.

**Traceability.** Commits stay in their own table — single source of truth, inherently tamper-proof because `apply()` can't touch them. The read layer synthesizes them as ChunkItems when relevant. Full projection — the root scope, items, and placements are all virtual. Nothing stored as real chunks or placements.

The lib exports `COMMITS_SCOPE` (`'__commits'`) as the virtual scope ID:

- `scope(db, [COMMITS_SCOPE])` → all commits as synthetic ChunkItems.
- `scope(db, [COMMITS_SCOPE, dispatchId])` → commits where `dispatch_id` matches.
- `scope(db, [COMMITS_SCOPE, chunkId])` → commits that modified that chunk (via `chunk_versions`).
- Connected scopes surface unique dispatch identities with counts.

The `commits` table carries a `dispatch_id` column. The engine sets it by passing `{ dispatch: dispatchId }` as the third argument to `apply()` when executing applies on behalf of invocables. No new tables, no placement inflation, no circularity. Commits look like chunks to every reader but are structurally separate.

### Boundaries

Boundaries operate at two levels:

**Invocable-level** — what the invocable CAN do by nature. Expressed as read and write boundary references on the invocable chunk's body. A bash invocable: read and write only its own dispatch scope. A filesystem invocable: read the dispatch scope for its command, write results to the dispatch scope. An agent invocable: wide open — defers all restriction to the dispatch.

**Dispatch-level** — what this specific run is ALLOWED to do. Set by the user at dispatch time. Read and write boundaries placed on the dispatch chunk.

The **effective boundary** is the intersection — the engine computes it at dispatch time. The dispatch can never widen what the invocable's nature allows. For nested dispatches (tool calls from an agent), the child's boundaries are intersected with the parent's — boundaries can only narrow, never widen. An invocable with no intrinsic boundary (e.g. `boundary: "open"`) is treated as the universal set — intersection with anything yields the other set.

**Boundaries are transitive via instance chains.** A boundary root `[agent]` grants access to everything reachable from `agent` by walking instance placements upward. When the invocable requests `scope(['my-session'])`, the engine checks: can `my-session` reach a boundary root through instance placements? `my-session` → instance on `session` → instance on `agent` → boundary root. Accessible. The boundary gates which scopes you can open. Once you open a scope, you see everything placed on it — instances and relates alike.

**The dispatch scope is always accessible.** Structural invariant: every invocable can always read and write within its own dispatch's scope tree. The dispatch chunk ID is implicitly a boundary root in both read and write boundaries. This is not a boundary entry — it's architectural. Without it, an invocable can't even read its own arguments.

**Read boundary.** The scopes the invocable can see. The engine checks instance-chain reachability from boundary roots. Connected scopes outside the boundary are visible as connections (names, counts) but not readable. The invocable sees the topology but cannot open doors outside its boundary.

**Write boundary.** The scopes the invocable can modify. Same instance-chain reachability check. The engine rejects any apply that touches a scope outside the effective set.

**Protected chunks.** The engine enforces that invocables cannot modify:
- The dispatch chunk itself (status, pid — engine domain)
- The boundary chunks placed on the dispatch (read-boundary, write-boundary instances)
These are the invocation's contract — set before spawn, immutable after.

Boundary references are structural — chunks placed as instances on read-boundary and write-boundary chunks. The chunks placed on them ARE the scope references by identity. Saved boundary configurations are reusable chunks.

### Tool-Call Dispatch

When the agent requests a tool call (e.g. `filesystem` read), the engine handles it:

1. Agent sends `dispatch` request via protocol: target invocable ID + arguments
2. Engine creates a dispatch chunk for the target invocable (instance of both the invocable and `dispatch`)
3. Engine computes the effective boundary: intersection of parent dispatch boundaries and the target invocable's intrinsic boundaries
4. Engine spawns the target invocable in the VM via the same pipe mechanism
5. Engine returns dispatch chunk ID immediately to the requesting invocable
6. Agent can await or continue working — the target invocable runs independently
7. On await, engine returns the completed dispatch's scope result
8. The agent records tool-call and tool-result on the session (dual placement)

Every tool call is a dispatch with its own trace. The dispatch chunk is persisted. Scope into it for what happened inside.

Substrate operations (scope, search, apply by the agent itself) are NOT tool-call dispatches — they go directly through the protocol. Only invocable-to-invocable calls are dispatches.

### Services

Deferred for the pilot. All invocables are request-response.

## Operational Behavior

### Timeout

The `dispatch` function accepts an optional `timeout` in ms. The engine writes it to the dispatch body as `timeout_ms`. If not provided, it defaults to the invocable chunk's `body.timeout_ms`. Invocable defaults: tool invocables (filesystem, shell, web): 30000ms. Agent invocables (claude): 300000ms. On expiry, the engine kills the process and sets `status: "failed"` with `body.error: "timeout"`.

### Error Handling

Not all errors kill the invocable. The distinction:

| Condition | Engine response |
|---|---|
| Boundary violation on scope/search | `BOUNDARY_VIOLATION` error response. Process continues. |
| Boundary violation on apply | `BOUNDARY_VIOLATION` error response. Process continues. |
| Spec violation on apply | `VALIDATION_ERROR` error response. Process continues. |
| Protected chunk modification | `BOUNDARY_VIOLATION` error response. Process continues. |
| Unknown op or missing fields | `INVALID_REQUEST` error response. Process continues. |
| Malformed JSON on stdout | Kill process. Set `status: "failed"`, `body.error: "protocol: malformed output"`. |
| Process crash (non-zero exit) | Set `status: "failed"`. |
| Process timeout | Kill process. Set `status: "failed"`, `body.error: "timeout"`. |

The invocable can recover from error responses — they are informational. Parse failures and crashes are terminal.

### Startup Reconciliation

On bootstrap, the engine queries all dispatch chunks with `status: "pending"` or `status: "running"` and sets them to `failed` with `body.error: "engine restart"`. The processes are gone — the engine does not attempt to recover them.

### Boundary Request Behavior

When an invocable calls `scope` or `search` and any queried scope is not reachable from the effective read boundary roots via instance chain traversal, the engine returns `BOUNDARY_VIOLATION`. The invocable gets an explicit error rather than a silently empty result — it knows it asked for something outside its boundary.

### VM Lifecycle

The VM is always used. Containment is architectural, not optional. The engine starts the VM on bootstrap and stops it on shutdown. All invocables share the single VM instance. The engine health-checks the VM before spawning; if it died, it restarts it.

For testing the engine protocol in isolation, a test harness can spawn mock invocables as local subprocesses — same pipe, same protocol, no real VM. This is for engine development only, not a runtime mode.
