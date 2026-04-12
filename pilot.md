# Pilot

The first end-to-end proof. Chunks go in, programs run against them, a person sees what happened. Four pieces: a substrate library (`ol`), an engine that manages dispatch and containment, a UI, and an agent loop. The lib owns the database. The engine mediates all invocable access to it. The UI is the human surface. The invocable runs sandboxed.

The substrate contract lives in [`substrate.md`](pilot/substrate.md). This document is the pilot — what gets built on it and how.

---

## What the Pilot Proves

- The self-describing field works. Specs are enforced, scopes compose, the UI is derived from what the field knows about itself.
- Dispatch is substrate-native. An invocable's contract is its spec. The UI reads the spec, generates the input surface, creates the dispatch as a chunk. No external configuration.
- Scope is the read mechanism. Knowledge assembled from scope each cycle — not snapshots, not tool calls.
- Every mutation is traceable: chunk → commit → dispatch → invocable → session.
- Boundaries are architectural. The invocable runs in a VM with no database access. The engine mediates — read boundary filters what the invocable sees, write boundary constrains what it can change.
- The full loop: scope, dispatch, agent cycle, answer and trace in the read tile.

## What the Pilot Defers

- **Peering.** Single database. Two root scopes approximate peer separation.
- **Services.** Request-response invocables only.
- **Derived chunks.** Summaries, embeddings — the pattern exists, generation is not in the pilot loop.
- **Temporal queries.** `--at` time travel.
- **Shell language.** Invocables are executables.
- **Packages.** No package management.
- **Native container.** UI runs in a browser tab.
- **Abstract adapter.** Hardcoded claude invocable.
- **Streaming.** Agent loop buffers responses.
- **Retention / deletion.** Pruning deferred.
- **Crash recovery.** PID recorded for future monitoring.

## Build Order

1. **`ol`** — substrate library + CLI. Done.
2. **Bootstrap** — seed script. Base archetypes, session types, invocable registrations, UI state.
3. **Engine** — dispatch creation, boundary enforcement, VM management, invocable protocol, lifecycle tracking.
4. **UI scaffold** — SvelteKit app with binary tree tiling.
5. **Command palette + selector** — the interaction layer. Tested before tiles depend on it.
6. **Read tile** — chunk rendering (inferred from structure), scope navigation, history.
7. **Dispatch tile** — contract resolution from spec, input modules inferred from accepted types. Calls the engine.
8. **Claude invocable** — the agent loop with tools, sub-agent support. Communicates with engine via protocol.

---

## The Stack

**Runtime.** TypeScript everywhere. Bun as the runtime. `bun:sqlite` for the substrate. SvelteKit on Bun for the UI. One language, no compilation step. The Zig rewrite comes when the substrate is proven.

**Host / VM split.** The lib, engine, and UI run on the host. The VM runs only invocables. The database lives on the host — the VM has no filesystem access to it. An invocable going rogue hits a wall: no path to the database except through the engine's protocol.

- **Host:** `ol` lib (direct database access), engine (dispatch, boundaries, lifecycle, VM management), UI (SvelteKit SSR, imports lib and engine directly)
- **VM:** Invocable executables only. Communicate with the engine via protocol. Public internet allowed (API calls). Private/local network blocked.

**Containment.** The VM is a lightweight Linux VM — not Docker (shared kernel, container escapes are real). OrbStack or Lima on macOS (Apple Virtualization.framework), Firecracker on Linux. Hardware-level isolation, separate kernel, real security boundary. The user interacts through the browser on the host.

**Directory structure:**

```
pilot/
  ol/              — substrate library + CLI
  engine/          — dispatch, boundaries, VM, invocable protocol
  ui/              — SvelteKit app
  invocables/      — claude invocable (runs in VM)
```

**VM packaging.** The VM is stateless — invocable code is mounted read-only via virtio-fs. `.env` for configuration (API keys). A setup script installs runtime dependencies. Reproducible environments come later.

---

## `ol` — Substrate Library + CLI

Full implementation of the substrate contract ([`substrate.md`](pilot/substrate.md)). Bun CLI + SQLite.

**Schema.** `chunk_versions`, `placement_versions`, `current_chunks`, `current_placements`, `commits`, `branches`, `chunk_fts`. Current-state tables updated in the same transaction as version writes.

**Commit model.** Auto-commit. Every mutation creates its own commit in a single SQLite transaction. For multi-operation atomicity, `ol apply` takes a declarative JSON payload and commits everything at once.

**Commands:**

| Command | Description |
|---|---|
| `ol init` | Create a new database |
| `ol apply` | Declarative mutation — JSON from stdin or `--input` flag. The sole write path. |
| `ol scope [ID...]` | Primary read — scope chunks, contents, connected scopes, counts |
| `ol search QUERY` | Full-text search over name and body string values |
| `ol log [--limit N]` | Commit history |
| `ol branch create NAME` | Create branch at current HEAD |
| `ol branch list` | List branches |
| `ol branch switch NAME` | Switch active branch |

**Apply payload:**

```json
{
  "chunks": [
    {
      "name": "my-chunk",
      "spec": { "ordered": true },
      "body": { "text": "content" },
      "placements": [
        { "scope_id": "existing-chunk-id", "type": "instance", "seq": 1 }
      ]
    },
    { "id": "existing-id", "body": { "text": "updated content" } },
    { "id": "to-remove", "removed": true }
  ]
}
```

No `id` = create (system-generated ID). With `id` = create with that ID (if new) or update (if exists). `removed: true` = soft remove. Placements are additive — new placements add alongside existing, not replace. Chunks processed sequentially within one transaction — later chunks can reference earlier ones. A chunk ID can appear multiple times to add placements in stages.

**Output.** JSON to stdout. Errors to stderr. Exit codes: 0 success, 1 user error, 2 system error.

**Database location.** `--db PATH` flag, or `OL_DB` env var, or `.openlight/db` in current directory.

---

## The Engine

The engine sits between the substrate library and everything that dispatches. It is the authority on dispatch creation, boundary enforcement, invocable lifecycle, and VM management. The UI calls the engine. Invocables call the engine. Nothing reaches the database without going through the lib — and nothing dispatches without going through the engine.

The engine is a TypeScript module imported directly by the UI's server functions — the interface is function calls, not a protocol. The JSON lines protocol is only for VM invocables communicating back through the pipe.

### What the Engine Owns

- **Dispatch creation.** Creates the dispatch chunk, validates the contract (all accepted types present), records it as instance of the invocable and `dispatch`. One atomic `apply()`.
- **Boundary enforcement.** Computes the effective boundary by intersecting the invocable's intrinsic boundaries with the dispatch's boundaries. Filters all scope/search results against the effective read boundary. Rejects any apply that touches a scope outside the effective write boundary. The session is always in both.
- **Invocable protocol.** Exposes an API that invocables in the VM call to interact with the substrate. The invocable sends requests (scope, search, apply, scope-change). The engine validates each request against the dispatch's boundaries and executes via the lib.
- **VM management.** Starts/stops the VM. Mounts invocable code read-only. Manages network policy (public internet allowed, local network blocked).
- **Process lifecycle.** Spawns invocable processes inside the VM. Tracks PID, status (running/completed/failed), start time. Kills on timeout or user request. Updates the dispatch chunk on completion. The engine owns the status state machine: `pending → running → completed/failed`. The engine sets `pending` on creation, `running` on spawn, and `completed` (exit 0) or `failed` (non-zero exit) on process exit. Status is a body field on the dispatch chunk, updated via `apply()`. The invocable does not set its own status — it simply exits.
- **Tool-call dispatch.** When an agent invocable requests a tool call, the engine creates a dispatch for the target invocable, spawns it in the VM, and returns the result. Same dispatch mechanics as any invocation. The tool dispatch's boundaries are the intersection of the parent dispatch's boundaries and the target invocable's intrinsic boundaries — the engine computes this at dispatch creation.

### Invocable Protocol

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
| `scope-change SCOPE_IDS` | Request to add scopes to working context, validated against read boundary |
| `dispatch INVOCABLE_ID ARGS` | Request a tool-call dispatch, engine creates and executes it |

Synchronous from the invocable's perspective — write request, read response. The latency (1-3ms via Lima, sub-ms via OrbStack) is negligible next to API call latency.

The invocable receives its dispatch ID as a command-line argument.

---

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

---

## The Agent

The claude invocable is the pilot's concrete agent. It runs in the VM, communicates with the engine via protocol, calls the Anthropic API directly (TypeScript SDK, raw API calls). The model is a dispatch argument or `.env` configuration — not hardcoded on the invocable chunk. No framework between the engine protocol and the API.

### Session Types

```
session
  spec: { ordered: true, accepts: ["prompt", "answer", "tool-call", "tool-result", "context"] }
  body (convention, not required): { started: ISO string }

prompt    (placed on agent, instance; placed on session, relates)
answer    (placed on agent, instance; placed on session, relates)
tool-call (placed on agent, instance; placed on session, relates)
  spec: { required: ["invocable"] }
  body also carries: tool_use_id (Anthropic API mapping), input (JSON) — convention for the agent loop
tool-result (placed on agent, instance; placed on session, relates)
  spec: { required: ["invocable"] }
context   (placed on agent, instance; placed on session, relates)
  spec: { ordered: true }
```

Type definitions use `relates` — they stay out of ordered content while remaining resolvable for `accepts`. Content chunks use dual placement: `instance` on the session (with seq) and `instance` on the archetype (for type membership).

Context as a session event means the exact scopes passed to the model are recorded — full traceability of what knowledge informed each response. Context is `ordered: true` without `accepts` — any chunk placed on it IS a scope reference by identity.

### Context, Pinning, and Scope Change

The dispatch's context chunk is the **pinned set** — assembled by the user at dispatch time, immutable from that point. Culture first (seq: 0), knowledge scopes after. The agent cannot modify the dispatch; it was committed before the invocable spawned.

When the agent expands its reading scope mid-dispatch, it writes a `context` event to the session. The host assembles each cycle: dispatch's pinned context first, then the agent's latest additions. The agent grows its view but cannot remove what was pinned. Every addition is checked against the read boundary.

The context events on the session are the trace — what the agent was reading at every turn.

### The Agent Cycle

1. Receives dispatch ID and engine endpoint. Calls `scope` via protocol to read the dispatch (session, context, prompt, read-boundary, write-boundary).
2. Calls `apply` to place prompt and context on session (dual placement, traceability)
3. Each cycle: assembles knowledge layer (pinned + additions) + session layer (tool chain), calls Anthropic API
4. On `tool_use`: calls `dispatch` via protocol — the engine creates a tool-call dispatch, executes it, returns the result. The agent records tool-call/tool-result on session.
5. On scope change: calls `scope-change` via protocol — the engine validates against read boundary, the agent writes a context event to session.
6. On `end_turn`: writes answer on session via `apply`, signals completion to the engine.

Every step is a chunk on the session. The read tile shows the full trace in order.

### Context Assembly

Two layers per API call:

- **Knowledge layer** — the agent's current scope serialized for the model. Re-assembled from the substrate each cycle. Culture first, then project knowledge, then active scopes.
- **Session layer** — the current dispatch's tool chain only. The chain grows within a dispatch (API requires it). Previous dispatches are visible through scope in the knowledge layer, not as native message history.

Whether knowledge goes in the system prompt (cacheable) or is manufactured as message history (more natural continuity) needs testing. The pilot should test both.

**Session chunk → API message mapping:**

| Chunk type | Maps to |
|---|---|
| `prompt` | `{ role: "user", content: body.text }` |
| `answer` | `{ role: "assistant", content: [{ type: "text", text: body.text }] }` |
| `tool-call` | `{ type: "tool_use", id: body.tool_use_id, name: body.tool, input: body.input }` — grouped into assistant message |
| `tool-result` | `{ type: "tool_result", tool_use_id: body.tool_use_id, content: body.text }` — grouped into user message |
| `context` | Not sent — traceability metadata |

### Tool Specs — Substrate to Anthropic API Mapping

Tool definitions for the Anthropic API call are derived from the substrate. No manual sync between what the system can do and what the model is told.

**Generating tool definitions.** The engine reads the invocable chunks within the dispatch's read boundary and generates a tool definition for each:

1. Invocable `name` → tool `name`
2. Invocable `body.text` → tool `description`
3. For each type in the invocable's `accepts`: read the type chunk's `spec.required` → `input_schema.required`. Read the type chunk's body for property schemas (types, enums, descriptions) → `input_schema.properties`.

Example — a filesystem invocable:

```
filesystem (instance of invocable)
  spec: { propagate: true, accepts: ["fs-command"] }
  body: { text: "Read and write files", executable: "./invocables/filesystem" }

fs-command (relates to filesystem)
  spec: { required: ["operation", "path"] }
  body: { text: "A filesystem operation", schema: {
    operation: { type: "string", enum: ["read", "write", "edit", "glob", "grep"] },
    path: { type: "string", description: "File or directory path" }
  }}
```

Generates:

```json
{
  "name": "filesystem",
  "description": "Read and write files",
  "input_schema": {
    "type": "object",
    "properties": {
      "operation": { "type": "string", "enum": ["read", "write", "edit", "glob", "grep"] },
      "path": { "type": "string", "description": "File or directory path" }
    },
    "required": ["operation", "path"]
  }
}
```

**Translating model responses back to dispatches.** When the model returns a `tool_use`, the engine creates the dispatch:

1. Model returns `{ id: "toolu_abc", name: "filesystem", input: { operation: "read", path: "/foo" } }`
2. Engine looks up the `filesystem` invocable, reads its `accepts` → `["fs-command"]`
3. Engine creates one `apply()`: fs-command chunk with `body: { operation: "read", path: "/foo" }` placed on a new dispatch chunk (instance of `filesystem` and `dispatch`), with boundaries computed from intersection of parent + invocable intrinsic
4. Engine spawns the invocable in the VM, returns result when done

**Tool-call session tracing.** The agent records the tool call on the session with a tool-call chunk. `required: ["invocable"]` — where `invocable` is the dispatch chunk ID (the specific invocation). The dispatch IS the record of what happened — the input is on it as typed chunks, the invocable's writes are traced to it. The `tool_use_id` from the Anthropic API is stored in body by convention for message mapping, not as a structural requirement.

### Sub-agents

A sub-agent is a dispatch — its dispatch IS its working scope (`ordered: true`). Parent session records tool-call (spawn) → tool-result (answer). Scope into the child dispatch for internal trace. Depth limit: 3.

### Culture

Not a special type. A chunk the user creates with values, instructions, identity. Placed first in the context ordering so the model reads it first. Culture is a convention, not a mechanism.

---

## The UI

A local web application. SvelteKit on Bun. Single window, internal tiling. Two fundamental operations: read scopes and dispatch invocations.

**Server layer.** SvelteKit SSR. Server functions import the substrate library for reads and the engine for dispatches.

**Reactivity.** After any `apply()`, the UI must reflect changes. The server knows when writes happen. A push mechanism (SSE or similar) from server to client on substrate writes. Exact approach to be determined.

**UI state.** Committed state (tile layout, scope assignments) is in the substrate — chunks like everything else. Transient state (in-progress input, drag-in-progress ratios) is client-side Svelte state. The boundary: completing an action commits. Everything before completion is transient.

### Tiling

Binary tree. Every split produces two children. Each node is a `split` or a `leaf`, expressed through placement.

```
split   spec: { ordered: true }
leaf    (no spec)
```

```
view-root (instance of split)
  body: { direction: "horizontal", ratio: 0.5 }

tile-1 (instance of leaf, placed on view-root, seq: 0)
  body: { scope: ["session-id"], mode: "read" }

tile-2 (instance of leaf, placed on view-root, seq: 1)
  body: { mode: "dispatch", invocable: "claude-id" }
```

| Operation | Action |
|---|---|
| Split H/V | Leaf becomes split. Original content in one child, new empty leaf in the other. |
| Close | Remove leaf. Parent split collapses, sibling promotes. Last tile cannot be closed. |
| Navigate | Directional — left/right/up/down through the tree. |
| Resize | Adjust parent split ratio. Keyboard or drag. |
| Swap | Exchange two leaves. |
| Rotate | Toggle split direction H↔V. |
| Zoom | Leaf temporarily replaces root. Same key restores. |
| Equalize | Reset all ratios to 0.5. |

### Read Tiles

A read tile shows chunks at a scope intersection. Ordered scopes respect seq. Collapse/expand per chunk or per type.

**Navigation.** Click a chunk to scope into it — the tile shows what's placed on that chunk. Current scope pushes onto the tile's history stack. Back key pops.

### Dispatch Tiles

An input surface for invoking. Does not render results — a read tile viewing the session does that. Read is passive and pure; dispatch is active and produces side effects.

The dispatch tile is generated from the composed dispatch contract. The UI reads the invocable's and `dispatch`'s specs, resolves each accepted type, and renders input modules.

**Dispatch flow:**

1. User selects session, assembles context and boundaries, writes prompt, hits send
2. UI calls the engine with the invocable ID and assembled arguments
3. Engine creates the dispatch, spawns the invocable in the VM

### Command Palette

Leader key opens a searchable overlay. Every operation is a command with a keybind:

```
Split horizontal         leader + s, h
Split vertical           leader + s, v
Close tile               leader + w
Navigate left/down/up/right   leader + h/j/k/l
Resize                   leader + H/J/K/L
Swap tiles               leader + x
Rotate split             leader + r
Zoom toggle              leader + z
Equalize                 leader + =
Change scope             leader + o
Select invocable         leader + i
Search                   leader + /
```

### Selector

One component used everywhere. Overlay with text input, filtered list, keyboard navigation. Sources: commands, chunks by name + FTS + scope history, invocable chunks.

### Components

The UI is built from a small vocabulary of general components. A `prompt` and an `answer` are both text — same component. Bespoke components are the exception.

**Display (read tiles):**

| Body shape | Component |
|---|---|
| `body.text` only | Markdown |
| `body.text` with other fields | Structured data, text as markdown inside |
| No `body.text` | Structured data, key-value |

Containers (chunks with children) offer expand/collapse. Click to scope in, or expand inline.

**Colors.** Each chunk derives a color from its name. Shown as a color trail along the scope path. Visual nesting.

**Input (dispatch tiles):**

For any accepted type in the dispatch contract, the UI renders an input inferred from the type's spec:
- Type with `ordered: true` → ordered scope-list builder
- Type with no spec → scope-selector (select existing or create new with text input)

Each accepted type resolves to one chunk — existing or newly created. The exact UX flow for selection vs creation is to be defined.

**Explicit override for exceptions.** A type can relate to a component chunk to override the default. For the pilot, defaults cover everything.

---

## Bootstrap

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

---

## Knowledge Serialization

The engine assembles the knowledge layer for the agent by reading scope contents and serializing them for the model. Starting format for the pilot:

```
# [scope-name]

[body.text of scope chunk]

## [child-name] (instance)

[body.text or structured fields]

## [child-name] (relates)

[body.text or structured fields]
```

Markdown with scope headers as section breaks. Culture scope first (anchors model interpretation). Instances before relates within each scope. Chunks without `body.text` render as key-value. Nested scopes indent or use sub-headers. The exact format will be refined through testing — this is the starting point, not the final form.

---

## What's Deferred

**UI interaction details.** Dispatch tile user flow (selection vs creation, inline assembly). UI inference for unordered scope-set types (boundaries). Context lifecycle display (pinned vs evolved). These resolve during UI implementation — build, see, adjust.

**File integration for invocable executables.** The invocable's `body.executable` is a path to a file. When that file changes, the substrate doesn't know. File integration (from `substrate.md`) tracks this through reference chunks with git-commit anchoring. The pattern applies beyond git-tracked files — the integration concept covers any external reference. Deferred for the pilot.

**System prompt vs manufactured history.** Needs testing — affects model behavior, caching, and identity. Both paths are structurally supported; the choice is empirical.

**Per-dispatch VM isolation.** Interesting direction (Firecracker, ~125ms boot) but not realistic for the pilot.
