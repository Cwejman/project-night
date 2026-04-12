# The UI

A local web application. SvelteKit on Bun. Single window, internal tiling. Two fundamental operations: read scopes and dispatch invocations.

**Server layer.** SvelteKit SSR. Server functions import the substrate library for reads and the engine for dispatches.

**Reactivity.** After any `apply()`, the UI must reflect changes. The server knows when writes happen. A push mechanism (SSE or similar) from server to client on substrate writes. Exact approach to be determined.

**UI state.** Committed state (tile layout, scope assignments) is in the substrate — chunks like everything else. Transient state (in-progress input, drag-in-progress ratios) is client-side Svelte state. The boundary: completing an action commits. Everything before completion is transient.

## Tiling

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

## Read Tiles

A read tile shows chunks at a scope intersection. Ordered scopes respect seq. Collapse/expand per chunk or per type.

**Navigation.** Click a chunk to scope into it — the tile shows what's placed on that chunk. Current scope pushes onto the tile's history stack. Back key pops.

## Dispatch Tiles

An input surface for invoking. Does not render results — a read tile viewing the session does that. Read is passive and pure; dispatch is active and produces side effects.

The dispatch tile is generated from the composed dispatch contract. The UI reads the invocable's and `dispatch`'s specs, resolves each accepted type, and renders input modules.

**Dispatch flow:**

1. User selects session, assembles context and boundaries, writes prompt, hits send
2. UI calls the engine with the invocable ID and assembled arguments
3. Engine creates the dispatch, spawns the invocable in the VM

## Command Palette

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

## Selector

One component used everywhere. Overlay with text input, filtered list, keyboard navigation. Sources: commands, chunks by name + FTS + scope history, invocable chunks.

## Components

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

## What's Deferred

**UI interaction details.** Dispatch tile user flow (selection vs creation, inline assembly). UI inference for unordered scope-set types (boundaries). Context lifecycle display (pinned vs evolved). These resolve during implementation — build, see, adjust.
