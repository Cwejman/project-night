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
body: { status: "pending"|"running"|"completed"|"failed", pid: number, started: ISO string }
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
4. Engine spawns the invocable in the VM, passing dispatch ID and engine endpoint
5. Invocable communicates with engine via protocol
6. On completion, engine updates dispatch status

**Traceability.** All writes relate back to the dispatch. The engine records the dispatch ID on every commit it executes on behalf of an invocable. Scope into `dispatch` for cross-invocable history; scope into the invocable for its own dispatches.

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
