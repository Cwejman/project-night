# Engine

The engine sits between the substrate library and everything that dispatches. It is the authority on dispatch creation, boundary enforcement, invocable lifecycle, and VM management. The UI calls the engine. Invocables call the engine. Nothing reaches the database without going through the lib — and nothing dispatches without going through the engine.

The engine is a TypeScript module imported directly by the UI's server functions — the interface is function calls, not a protocol. The JSON lines protocol is only for VM invocables communicating back through the pipe.

## What the Engine Owns

- **Dispatch creation.** Creates the dispatch chunk, validates the contract (all accepted types present), records it as instance of the invocable and `dispatch`. One atomic `apply()`.
- **Boundary enforcement.** Computes the effective boundary by intersecting the invocable's intrinsic boundaries with the dispatch's boundaries. Filters all scope/search results against the effective read boundary. Rejects any apply that touches a scope outside the effective write boundary. The session is always in both.
- **Invocable protocol.** Exposes an API that invocables in the VM call to interact with the substrate. The invocable sends requests (scope, search, apply). The engine validates each request against the dispatch's boundaries and executes via the lib.
- **VM management.** Starts/stops the VM. Mounts invocable code read-only. Manages network policy (public internet allowed, local network blocked).
- **Process lifecycle.** Spawns invocable processes inside the VM. Tracks PID, status (running/completed/failed), start time. Kills on timeout or user request. Updates the dispatch chunk on completion. The engine owns the status state machine: `pending → running → completed/failed`. The engine sets `pending` on creation, `running` on spawn, and `completed` (exit 0) or `failed` (non-zero exit) on process exit. Status is a body field on the dispatch chunk, updated via `apply()`. The invocable does not set its own status — it simply exits.
- **Tool-call dispatch.** When an agent invocable requests a tool call, the engine creates a dispatch for the target invocable, spawns it in the VM, and returns the result. Same dispatch mechanics as any invocation. The tool dispatch's boundaries are the intersection of the parent dispatch's boundaries and the target invocable's intrinsic boundaries — the engine computes this at dispatch creation.

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
| `scope [ID...]` | Read scope, filtered by read boundary. External connections visible (names, counts) but not readable. |
| `search QUERY` | Full-text search, filtered by read boundary |
| `apply DECLARATION` | Write, checked against write boundary |
| `dispatch INVOCABLE_ID ARGS` | Dispatch another invocable, engine creates dispatch chunk and spawns it |

Synchronous from the invocable's perspective — write request, read response. The latency (1-3ms via Lima, sub-ms via OrbStack) is negligible next to API call latency.

The invocable receives its dispatch ID as a command-line argument.

**Client library.** The engine exports a client module (`engine/client.ts`) that wraps the protocol — typed functions (scope, search, apply, dispatch) over stdin/stdout serialization. Invocables import the client, not raw IO. Same types as the substrate lib, same API shape. The engine and client are two halves of one contract.

**Testing without VM.** The protocol is stdin/stdout — the VM adds containment, not functionality. For development and TDD, the engine spawns invocables as local subprocesses on the host. Same pipe, same protocol, no VM overhead. The full cycle (dispatch creation → invocable spawn → protocol communication → boundary enforcement → completion) is testable entirely on the host.

## Invocables

An invocable is a chunk with an executable in its body — an instance of the `invocable` archetype (`spec: { required: ["executable"] }`). The UI discovers invocables by scoping into `invocable`. All invocables run in the VM. The engine spawns them all via the same pipe mechanism — some return fast (filesystem read), some are long-running (agent loop). The containment model is the same.

### Dispatch

A dispatch is a chunk that records an invocation. Every dispatch is an instance of both its invocable and the `dispatch` base archetype. The invocable carries its specific contract. The `dispatch` archetype carries the universal contract. Both use `propagate: true`, so the substrate composes them by union onto the dispatch instance.

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

The **effective boundary** is the intersection — the engine computes it at dispatch time. The dispatch can never widen what the invocable's nature allows.

**Read boundary.** The scopes the invocable can see. The engine filters all scope/search results against the effective set. Connected scopes outside it are visible as connections (names, counts) but not readable. The invocable sees the topology but cannot open doors outside its boundary.

**Write boundary.** The scopes the invocable can modify. The session is always writable (the dispatch's own trace). Knowledge scopes require explicit grant. The engine rejects any `apply` that touches a scope outside the effective set.

Boundary references are structural — chunks placed as instances on read-boundary and write-boundary chunks. The chunks placed on them ARE the scope references by identity. Saved boundary configurations are reusable chunks.

### Tool-Call Dispatch

When the agent requests a tool call (e.g. `filesystem` read), the engine handles it:

1. Agent sends `dispatch` request via protocol: target invocable ID + arguments
2. Engine creates a dispatch chunk for the target invocable (instance of both the invocable and `dispatch`)
3. Engine computes the effective boundary: intersection of parent dispatch boundaries and the target invocable's intrinsic boundaries
4. Engine spawns the target invocable in the VM via the same pipe mechanism
5. Target invocable executes, communicates via protocol, exits
6. Engine returns the result to the requesting invocable
7. The agent records tool-call and tool-result on the session (dual placement)

Every tool call is a dispatch with its own trace. The dispatch chunk is persisted. Scope into it for what happened inside.

Substrate operations (scope, search, apply by the agent itself) are NOT tool-call dispatches — they go directly through the protocol. Only invocable-to-invocable calls are dispatches.

### Services

Deferred for the pilot. All invocables are request-response.
