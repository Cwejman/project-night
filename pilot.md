# Pilot

End-to-end proof of the system: substrate, interface, invocables. The minimum surface to get chunks in, invoke programs, and view results.

## The Stack

**Runtime:** TypeScript everywhere. Bun as the runtime. `bun:sqlite` for the substrate. SvelteKit on Bun for the UI (SSR — server functions import the substrate library directly, no separate API layer). One language, no compilation step, fast iteration. The Zig rewrite comes when the substrate is proven. The native container comes when the UI outgrows a browser tab.

**Shared library.** The substrate is a TypeScript library first, CLI second. The UI's server functions import the library directly — no exec, no serialization overhead for internal operations. The CLI (`ol`) wraps the same library for terminal use. Invocables import the library directly.

**Containment.** The entire pilot runs inside a lightweight Linux VM — not Docker (shared kernel, container escapes are real). OrbStack or Lima on macOS (Apple Virtualization.framework), Firecracker on Linux. The project directory is mounted via virtio-fs. Public internet is allowed (for API calls). Private/local network is blocked at the VM's virtual network level. The SvelteKit server, substrate, and all invocables run inside the VM. The user interacts through the browser on the host — the UI is just a web page served from the VM's exposed port. Hardware-level isolation, separate kernel, real security boundary.

**Directory structure:**

```
pilot/
  ol/              — substrate library + CLI
  ui/              — SvelteKit app
  invocables/      — claude invocable
```

**Two root scopes (simulated peers).** Even without peering, the bootstrap structures the database as two root scopes:

- `agent` — contains session types, dispatch archetype, the claude invocable registration
- `ui` — contains UI state types (split, leaf), the view tree, scope history

This simulates the peer model from the start. When peering arrives, these naturally become separate databases.

**Bootstrap — one apply call.** Chunks with user-supplied IDs are processed sequentially, so later chunks can reference earlier ones. The full bootstrap in one atomic commit:

1. Root scopes: `agent` (id: "agent"), `ui` (id: "ui")
2. Session archetype placed on `agent`: `session` (id: "session")
3. Session event types, each placed on `agent` (instance, root membership) AND `session` (relates, for `accepts` name resolution): `prompt`, `answer`, `tool-call`, `tool-result`, `context`
4. `dispatch` archetype placed on `agent`
5. IO invocables placed on `agent`: `filesystem` (read, write, edit, glob, grep), `shell` (bash execution), `web` (web search — Anthropic server-side)
6. `claude` invocable placed on `agent`
7. `claude-dispatch` placed on `claude` (instance) and `dispatch` (relates — dispatch is ordered, type definitions use relates), with type references (`session`, `context`, `prompt`) placed on it as `relates`
8. `split` and `leaf` archetypes placed on `ui`
9. `view-root` as instance of `leaf`, placed on `ui` — the initial empty tile
10. `scope-history` placed on `ui` — ordered scope for tracking viewed scopes

**First run.** On first launch, the database is bootstrapped with the above. The initial view-root is a single leaf tile with no scope assigned. The command palette opens immediately — the user's first action is to create or select a scope.

**VM packaging.** The VM is stateless — the project filesystem (mounted via virtio-fs) IS the persistent state. A `.env` file in the project root holds configuration (API keys, model selection). Package installation: a setup script in the project that runs on VM start — installs Bun, dependencies, starts the SvelteKit server. For the pilot this can be a simple shell script; reproducible environments (Nix, Dockerfile as spec) come later.

### `ol` — Substrate Bin

Full implementation of `substrate.md`. Bun CLI + SQLite.

**Schema:** `chunk_versions`, `placement_versions`, `current_chunks`, `current_placements`, `commits`, `branches`, `chunk_fts`. Current-state tables updated in the same transaction as version writes. No special tables for summaries or embeddings — derived data is just chunks placed on derivation scopes.

**Commit model:** Auto-commit. Every mutation creates its own commit in a single SQLite transaction — no staging area, no separate commit step. For multi-operation atomicity, `ol apply` takes a declarative JSON payload and commits everything at once. Same model as the existing Zig CLI.

**Commands:**

Write:
- `ol init` — create a new database
- `ol apply` — declarative mutation. JSON from stdin or `--input` flag. The sole write path — all mutations go through apply, whether from the CLI, the UI (via library), or invocables (via library).

**Apply payload format:**

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
    {
      "id": "existing-id",
      "body": { "text": "updated content" }
    },
    {
      "id": "to-remove",
      "removed": true
    }
  ]
}
```

No `id` = create (system-generated ID). With `id` = create with that ID (if new) or update (if exists). `removed: true` = soft remove. Placements are nested inside chunks and are **additive** — applying new placements to an existing chunk adds them alongside existing placements, does not replace. Chunks are processed sequentially within one transaction — later chunks can reference IDs of earlier chunks in the same payload. A chunk ID can appear multiple times in the same payload to add placements in stages (e.g., create the chunk first, then add more placements after its targets exist).

Read:
- `ol scope [ID...]` — the primary read operation. Returns the scope chunks themselves (full data), in-scope contents with placements, connected scopes sorted by shared count with inter-connections, head commit for staleness, and total/in-scope/instance/relates counts. With no IDs returns system-wide counts. This is a navigation tool — it tells you where you are, what's here, and where you can go.
- `ol search QUERY` — full-text search over name and body string values. Returns matching chunks with placements.
- `ol log [--limit N]` — commit history
- `ol branch list` — list branches

Branch management:
- `ol branch create NAME` — create a branch at current HEAD
- `ol branch switch NAME` — switch active branch

**Spec enforcement on write:**

- `ordered: true` — placements must have seq. Auto-assigned on append if omitted.
- `accepts: [...]` — instance must be instance of a listed type (resolved within scope). A chunk must not be an instance of two types that both appear in the same scope's `accepts` list — reject on write to prevent type ambiguity.
- `required: [...]` — body must contain listed keys
- `unique: [...]` — values must be unique across scope instances

**Output format:** JSON to stdout. Errors to stderr. Exit codes: 0 success, 1 user error, 2 system error.

**Database location:** `--db PATH` flag, or `OL_DB` env var, or `.openlight/db` in current directory.

### UI — Read + Dispatch

A local web application. SvelteKit on Bun. Single window, internal tiling. Two fundamental operations: read scopes and dispatch invocations.

**Server layer:** SvelteKit SSR. Server functions (`+page.server.ts`) import the substrate library directly. No separate API. The framework handles the server/client boundary.

**Reactivity:** After any `apply()`, the UI must reflect changes. With data arriving from invocables and potentially services — not just human-triggered dispatches — polling is insufficient. The server knows when writes happen (invocables use the substrate library directly). A push mechanism (SSE or similar) from server to client on substrate writes is the natural fit. Exact approach to be determined.

**UI state.** Committed UI state (tile layout, scope assignments) is in the substrate — chunks like everything else. Transient UI state (in-progress form input, pre-send dispatch drafts, drag-in-progress resize ratios) is client-side Svelte component state. The boundary: completing an action commits (send, mouse-up on resize, confirming a split). Everything before completion is transient and local.

#### Tiling — Binary Tree

Every split produces two children. Each node is either a split or a leaf. The role is expressed through placement (instance of the `split` or `leaf` archetype), not body fields.

**Archetypes:**

```
chunk: split
  spec: { ordered: true }
  body: { text: "A split node in the tile tree" }

chunk: leaf
  body: { text: "A leaf node in the tile tree" }
```

**Example tile tree:**

```
chunk: view-root (instance of split)
  body: { direction: "horizontal", ratio: 0.5 }

chunk: tile-1 (instance of leaf, placed on view-root, seq: 0)
  body: { scope: ["session-id"], mode: "read" }

chunk: tile-2 (instance of leaf, placed on view-root, seq: 1)
  body: { mode: "dispatch", invocable: "claude-id" }
```

Nested split:

```
chunk: split-2 (instance of split, placed on view-root, seq: 1)
  body: { direction: "vertical", ratio: 0.5 }

chunk: tile-2 (instance of leaf, placed on split-2, seq: 0)
chunk: tile-3 (instance of leaf, placed on split-2, seq: 1)
```

**Tile operations:**

| Operation | Action |
|---|---|
| Split H/V | Current leaf becomes a split. Original content in one child, new empty leaf in the other. |
| Close | Remove leaf. Parent split collapses, sibling promotes up. Last tile cannot be closed. |
| Navigate | Directional — left/right/up/down. Traverses the tree spatially. |
| Resize | Adjust parent split's ratio. Keyboard increment or drag border. |
| Swap | Exchange two leaves in the tree. |
| Rotate | Toggle parent split direction H↔V. |
| Zoom | Current leaf temporarily replaces root. Same key restores. |
| Equalize | Reset all ratios to 0.5. |

#### Read Tiles

A read tile shows chunks at a scope intersection. The primary read surface.

Ordered scopes respect seq. Collapse/expand per chunk or per type.

**Navigation.** Click a chunk (or keyboard select + enter) to scope into it — the tile shows what's placed on that chunk. Current scope pushes onto the tile's history stack. Back key pops.

**Type-aware rendering.** Types connect to general UI components. See "Components" below.

#### Dispatch Tiles

A dispatch tile is an input surface for invoking. It does not render results — a read tile viewing the session does that. Read and dispatch are fundamentally separate: read is passive and pure, dispatch is active and produces side effects.

The dispatch tile is generated from the invocable's dispatch type contract. The UI reads the dispatch type's `accepts` spec and composes input modules for each accepted type. See "Components" and "Dispatch Contracts" below.

#### Command Palette

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

#### Selector

One component used across the UI. An overlay with text input, filtered list, keyboard navigation (up/down, enter, esc). Used for:

- Command palette: source = commands
- Scope selector: source = chunks by name + FTS, plus scope history (previous scopes the user has viewed — just a context scope, not a special mechanism)
- Invocable selector: source = invocable chunks

### Invocables — Core Mechanics

An invocable is a chunk in the substrate with an executable reference in its body (file integration). The UI discovers invocables by querying the substrate.

**Dispatch is a base archetype.** Every invocation creates a dispatch chunk — a record that persists in the substrate. Dispatch history is native: scope into `dispatch` to see everything ever invoked.

```
chunk: dispatch
  spec: { ordered: true }
  body: { text: "A dispatch event" }
```

**All writes an invocable makes relate back to its dispatch chunk.** Full traceability: for any chunk the invocable produced, you can find the dispatch that caused it.

**The invocable receives one thing: the dispatch chunk ID.** Everything it needs is on the dispatch scope — the UI populates the dispatch before triggering the invocable.

**Triggering:** The SvelteKit server spawns the invocable as a subprocess via Bun's subprocess API: `Bun.spawn(['./invocables/claude', dispatchId])`. The invocable receives the dispatch ID as an argument and the database path via environment variable. All processes run within the container's trust boundary.

### The Agent Case — Pilot Use Case

The following types and invocable are the concrete use case for the pilot, separate from the core invocable mechanics above.

**Session types:**

```
chunk: session
  spec: { ordered: true, accepts: ["prompt", "answer", "tool-call", "tool-result", "context"] }
  body: { text: "A sequence of agent interaction events" }

chunk: prompt (placed on agent, instance; placed on session, relates)
  body: { text: "A user message" }

chunk: answer (placed on agent, instance; placed on session, relates)
  body: { text: "An agent response" }

chunk: tool-call (placed on agent, instance; placed on session, relates)
  spec: { required: ["invocable"] }
  body: { text: "A tool invocation" }

chunk: tool-result (placed on agent, instance; placed on session, relates)
  spec: { required: ["invocable"] }
  body: { text: "The result of a tool invocation" }

chunk: context (placed on agent, instance; placed on session, relates)
  spec: { ordered: true }
  body: { text: "The knowledge context passed for this turn" }
```

Context as a session event means the exact scopes passed to the model for each dispatch are recorded in session history — full traceability of what knowledge informed each response. Context is `{ ordered: true }` without `accepts` — any chunk placed on it IS a scope reference by identity. No `scope-ref` wrapper type needed.

**Type definitions use `relates`.** Type definitions (prompt, answer, etc.) are placed on their parent scope (session) as `relates`, not `instance`. This avoids `ordered` enforcement — type definitions don't need seq numbers and don't appear in content ordering. `accepts` name resolution works from all placements, so `relates` placements resolve correctly.

**Dual placement for content chunks.** Every content chunk placed on a session needs TWO placements: one `instance` on the session (with seq, making it an ordered member) and one `instance` on its archetype (making it typed). Example: a prompt content chunk is placed on `my-session` (instance, seq: 0) AND on `prompt` (instance). This is how `accepts` enforcement works — the session checks that the chunk is an instance of one of its accepted types.

**Culture.** Not a special type. A chunk (or scope) the user creates with values, instructions, identity. Included in the context when dispatching — first in order, so the model reads it first. Culture is a convention, not a mechanism.

**The claude invocable — hardcoded for the pilot:**

A concrete Claude agent, not an abstract adapter. Model is hardcoded (e.g. `claude-opus-4-6`). Abstraction to a model-agnostic adapter comes later.

```
chunk: claude
  body: { text: "Claude agent", executable: "./invocables/claude", model: "claude-opus-4-6" }
```

**Runtime:** Anthropic TypeScript SDK, raw API calls. The invocable implements the agent loop directly — call the model, check for tool_use, dispatch to invocables, send results back, repeat. No framework between the substrate and the API. Full control over context assembly and tool execution.

**Invocable model.** Tool calls are invocables — entities in the substrate with identity. IO invocables (filesystem, shell, web) are registered chunks. Every tool call creates a dispatch on the invocable's scope — the same model as any invocation. The host executes IO invocables inline and bridges results to the API as `tool_result`. Containment, traceability, and visibility are structural: the dispatch carries boundaries, the invocable's scope shows everything it's done. Substrate operations (search, apply) are native — not invocable dispatches.

**Tool specs from the substrate.** Invocable capabilities are specced in the substrate. The dispatch defines accessible scopes, those scopes have specs. Tool definitions for the API call can be derived — the tool surface reflects what's actually possible for this dispatch. No manual sync between what the system can do and what the model is told.

**Scope as read.** The agent doesn't read the substrate through snapshot tool calls. Each cycle, the host assembles context from the agent's current scope — knowledge appears fresh, not as historical `tool_result` messages. How the agent changes scope mid-dispatch is open (see "What's Open").

**Containment.** Every `apply` carries the dispatch ID. The commit records who caused it. The binary enforces scope boundaries — the dispatch's context defines where writes are allowed. Read and write scopes are separate. The exact mechanism for expressing boundaries and protecting scopes from modification is open (see "What's Open").

**The agent cycle:**

1. Receives dispatch ID, reads dispatch scope (session, context, prompt)
2. Places prompt and context on session (dual placement, traceability)
3. Each cycle: assembles context from scope (knowledge layer) + current dispatch's tool chain (session layer), calls API
4. On tool_use: dispatches to invocable or executes substrate operation, records tool-call/tool-result on session (dual placement, `tool_use_id` linked)
5. On end_turn: writes answer on session, relates to dispatch, updates dispatch status

Every step is a chunk on the session. The read tile shows the full trace in order.

**Context assembly.** Two layers per API call:

- **Knowledge layer** — the agent's current scope serialized into the context section. Re-assembled from the substrate each cycle. Culture first, then project knowledge, then active scopes.
- **Session layer** — the current dispatch's tool chain only. Within a dispatch, the chain grows (API requires it). Previous dispatches are visible through scope in the knowledge layer, not as native message history.

Whether knowledge is best placed in the system prompt or manufactured as message history affects model behavior and caching. System prompt is cacheable and cheaper; manufactured history may provide more natural continuity. The pilot should test both.

**Session chunk → API message mapping.** When session history is embedded as native messages (vs serialized into the system prompt), chunks map as follows:

| Session chunk type | Maps to |
|---|---|
| `prompt` | `{ role: "user", content: body.text }` |
| `answer` | `{ role: "assistant", content: [{ type: "text", text: body.text }] }` |
| `tool-call` | `{ type: "tool_use", id: body.tool_use_id, name: body.tool, input: body.input }` — grouped into one assistant message |
| `tool-result` | `{ type: "tool_result", tool_use_id: body.tool_use_id, content: body.text }` — grouped into one user message |
| `context` | Not sent as a message — traceability metadata |

**Knowledge serialization format** — to be explored. Scope headers as section breaks, culture first for framing. Exact format is an implementation question.

**Dispatch tracking.** Dispatch body records: `status` (running/completed/failed), `pid`, `started`, `model`, `depth`. The SvelteKit server manages dispatch lifecycle — listing running dispatches, killing processes.

**Seq assignment.** On ordered scopes, seq is auto-assigned on append (next value, like an ID). Explicit seq only needed for specific positioning.

**Sub-agents.** A sub-agent is a dispatch — its dispatch IS its working scope (`ordered: true`). Parent session records tool-call (spawn) → tool-result (answer). Scope into the child dispatch for internal trace. Depth limit: 3.

### Services

All invocables are processes — some short-lived, some persistent. A service writes to its own scope continuously (speech-to-text, VM health, log aggregation). Services don't participate in tool_use/tool_result — their output is ambient, visible through scope. The substrate doesn't distinguish services from dispatched invocables — the difference is lifecycle. Deferred for the pilot.

### Components — General, Inferred by Default

The UI is built from a small vocabulary of general components. Common data, common display, common interaction. A `prompt` and an `answer` are both text — they use the same component. A bespoke component is the exception. When building invocables and types, prefer general components. This prevents the isolation the substrate dissolves.

**Display components (for read tiles):**
- `markdown` — renders `body.text` as markdown
- `structured-data` — renders body fields as labeled key-value pairs, with `body.text` rendered as markdown within when present

**Display rules inferred from body shape:**
1. `body.text` only, no other fields → **markdown** (prompt, answer content)
2. `body.text` WITH other fields → **structured-data** with text as markdown inside (tool-call, tool-result, session instances)
3. No `body.text` → **structured-data** as pure key-value (split instances, leaf instances)

Chunks that are containers (have children placed on them): the read tile offers expand/collapse. Click to scope in, or expand inline to see children. The scope query tells the UI whether a chunk has contents.

**Colors.** Each chunk derives a color from its name's character combination. Shown in context as a color trail along the path: `agent/session/prompt` is three colors in sequence. Visual nesting — you see where you are. Each name derives its color independently.

**Input components (for dispatch tiles):**
- `scope-selector` — scope picker with completion and FTS. Can both select an existing chunk and create a new one.
- `multiline-text` — text area for creating text content
- `value-input` — single-line input for simple values

**Input rule:** For any accepted type in the dispatch contract, render a **scope-selector** that can select an existing instance or create new. The creation flow adapts to the type's structure — a type with no spec creates with text input for body, a type with `ordered` creates with a list builder. One component, context-adaptive.

Each accepted type resolves to one chunk — either an existing one or a newly created one. The UX flow for selection/creation needs to be defined before implementation.

**Explicit override for exceptions:** A type can relate to a component chunk (file integration) to override the default. The override doesn't modify the type — it adds a relation. A peer can ship custom components and register them as overrides for specific types when the general components genuinely don't serve the case.

For the pilot, defaults cover everything. No explicit registrations needed.

### Dispatch Contracts

The dispatch type's `accepts` spec is the contract — the same `accepts` already in the substrate, already enforced. No new mechanism.

**The claude dispatch type:**

```
chunk: claude-dispatch (placed on claude, instance; placed on dispatch, relates)
  spec: { ordered: true, accepts: ["session", "context", "prompt"] }
  body: { text: "Dispatch contract for claude" }
```

Type references on `claude-dispatch` (makes names resolvable within its scope via `relates`):

```
session  (placed on claude-dispatch, relates)
context  (placed on claude-dispatch, relates)
prompt   (placed on claude-dispatch, relates)
```

**Cardinality through nesting.** At the dispatch level, each accepted type is singular. Context is itself an ordered scope — place multiple scopes on it to pass a list. No `scope-ref` wrapper type needed — chunks placed on context ARE the scope references by identity.

**Context assembly.** A context scope can be selected (an existing, pre-assembled context) or assembled inline at dispatch time by placing scopes on a new context chunk. The session records context as a first-class event, so the exact knowledge passed for each turn is traceable. UI/UX details of context assembly (inline editing, saved contexts, reuse) to be settled during implementation.

**Dispatch creation — one atomic `apply()`.** The UI creates the prompt chunk, the dispatch chunk, the context chunk, and all placements in a single `apply()` call. One commit. No partially-created dispatches.

**Dispatch flow:**

1. User selects session, assembles context (places scopes on context), writes prompt, hits send
2. One `apply()`: creates prompt chunk (instance of `prompt`), creates context chunk (instance of `context`) with scope placements, creates dispatch chunk (instance of `claude-dispatch`), places session/context/prompt on dispatch with seq 0/1/2
3. Server spawns invocable: `Bun.spawn(['./invocables/claude', dispatchId])`

### What's Open

**Context is invocable-specific, not substrate native.** Explored: the substrate has chunks, placements, and peers — it does not have "context" as a primitive. Context is a chunk the claude invocable (or any agent invocable) defines for its own purpose of assembling the system prompt. Other invocables may have no such concept. Pinning and scope change are therefore not substrate features; they are how the agent invocable manages its working scope on top of the substrate's primitives.

**Boundaries compose at two levels.** Explored: read and write permissions come from both the invocable's intrinsic nature (what kind of thing the invocable is — a bash invocable writes to its log, a filesystem invocable touches files) and the dispatch's per-invocation setup (what the human allows for this run). Both must grant access for an operation to be permitted. An agent invocable may have wide-open permissions at the invocable level, deferring all restriction to the dispatch. Narrower invocables carry constraints in their nature that the dispatch cannot expand. Where these permissions are expressed structurally — on the invocable chunk, on the dispatch chunk, as placements, as spec data — is not yet uncovered.

**Scope change mid-dispatch is required, not optional.** Explored: the agent must be able to change its working scope while running; without that freedom, the dispatch is too constrained for real knowledge work. Pinning exists precisely to constrain this freedom selectively, so scope change is a core capability, not a detail to defer. Earlier thinking proposed writing a new context chunk on the session each cycle and having the host read the latest for the next cycle; how this composes with pinning is part of the exploration below.

**Pinning — shapes explored, nothing settled.** Pinning means the human specifies scopes the agent cannot remove from its working scope during a dispatch. Several structural expressions were considered and none are chosen:

- *Two chunks, merged by order.* A pinned chunk set at dispatch creation (locked) and an agent-managed chunk. The host concatenates them pinned-first when assembling the system prompt. Ordering pinned content first is semantically natural: earlier content anchors model interpretation, so the pinned sequence gains weight by position. The initial concern that two chunks fragment the context dissolves if the merge order is deterministic.
- *Single chunk, append-only write.* One context chunk the agent can append to but cannot modify or remove placements from. Requires an append-only write mode not present in the current spec language.
- *Write boundary on the pinned chunks themselves.* Lock the chunks that are pinned (culture, etc.) so the agent cannot affect them, including removing their placements on its context. Clean in a single database; does not hold in the peer model, because placements live in the writing peer — the placement `(culture, context)` lives in the project peer (writable) even though culture lives in a read-only peer. Peer boundaries protect chunk contents across databases but do not protect placements within the writable database.
- *Read permissions gate additions to working scope.* What the agent can read is what it can add; what it cannot read, it cannot bring into scope. Read permissions become the primary control for what enters context; write permissions then constrain what the agent can modify of what is there. Combined with write constraints on the pinned content, this may be the most natural direction, but the mechanics are not yet clear.

The natural shape likely composes read permissions, write permissions, and ordering; how is still to be uncovered.

**Claude dispatch structure — possible simplification.** Explored: the current spec defines `claude-dispatch` as an intermediary chunk between the `claude` invocable and the `dispatch` base archetype, carrying the `accepts` contract and the type references. An alternative worth testing is that the invocable chunk itself carries the dispatch contract — its spec defines what a dispatch must contain (`accepts: ["session", "context", "prompt"]`), its body defines its capabilities, and a dispatch is simply an instance placed on the invocable. Removes one layer of indirection. Not validated against the wider set of invocables or edge cases.

**The agent works with knowledge, not just sessions.** Explored: the session is the trace of what the agent did. The actual work is knowledge — the agent reads knowledge scopes and writes new chunks into knowledge scopes it has write access to. Treating the session as the agent's entire output misses the point of the system. This reframing touches how write boundaries should be thought about: the agent's write scope is not "the session" — it is the set of knowledge scopes the dispatch allows it to modify, of which the session is one.

**System prompt vs manufactured history.** Scope-assembled knowledge can go in the system prompt (cacheable, the model reads about context) or be manufactured as message history (more expensive, the model continues from experience). Different identity, not necessarily worse. Needs testing.

**Containment enforcement.** Dispatch ID on apply — the binary checks scope boundaries. ID must be unguessable (UUID). Exact checking mechanics at the binary level need detail.

**Dispatch tile user flow.** How does the user move between selecting existing vs creating new chunks? How does inline assembly of context work visually?

**Knowledge serialization format.** How scope content is serialized for the model. Structured text vs JSON vs markdown — implementation question.

**Per-dispatch VM isolation.** Interesting direction (Firecracker, ~125ms boot) but not realistic for the pilot given latency. A point of interest, not a requirement.

---

## What the Pilot Proves

- Chunks go in via `ol`. Spec enforcement works. Scope queries return the right intersections.
- The UI shows scopes as tiled panels. UI state is substrate state.
- Dispatch is substrate-native. Tool calls are invocable dispatches with scope.
- Scope is the read mechanism. Knowledge assembled from scope each cycle.
- Tool specs derived from the substrate — model's tool surface reflects what's possible.
- Every mutation traceable: chunk → commit → dispatch → invocable → session.
- Containment: VM as outer wall, dispatch-scoped apply as inner wall.
- The full loop: scope, dispatch, agent cycle, answer and trace in the read tile.

## What the Pilot Defers

- **Peering.** Single database.
- **Services.** The pilot doesn't build services — only request-response invocables.
- **Summaries.** Derived chunks — pattern exists, generation not in pilot loop.
- **Temporal queries.** `--at` time travel.
- **Shell language.** Invocables are executables.
- **Packages.** No package management.
- **Native container.** UI runs in a browser tab.
- **Abstract adapter.** Hardcoded claude invocable.
- **Streaming.** Agent loop buffers responses.
- **Retention / deletion.** Pruning deferred — agents should always be able to look back.
- **Crash recovery.** PID recorded for future monitoring.

## Build Order

1. **`ol`** — substrate library + CLI. Done.
2. **Bootstrap data** — base archetypes (split, leaf, dispatch, session types, claude invocable registration). Seed script.
3. **UI scaffold** — SvelteKit app with binary tree tiling.
4. **Command palette + selector** — the interaction layer. Tested and proven before tiles depend on it.
5. **Read tile** — chunk rendering (inferred from structure), navigation, scope history.
6. **Dispatch tile** — contract resolution from dispatch type spec, input modules inferred from accepted types.
7. **Claude invocable** — the agent loop with tools, sub-agent support, dispatch lifecycle, containment. Full tool-call transparency from the start.
