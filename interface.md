# Interface Layer

The visual and interaction layer for the system. The GUI is optional — the engine works from a TTY or API. But the interaction model (scope navigation, type-resolved invocation, multidimensional knowledge) benefits from a richer interface than a terminal can provide.

This connects to a long-held intuition about how computing should work. Today's programs are monolithic at the UI level — Safari owns your tabs, IDEA owns its tool windows, AWS owns its navigation. You're locked into each program's frame. The scope model offers something more natural: navigate by meaning, not by application. Whether this fully holds is to be explored, but the feeling is that scope-based interfacing may work for everything — agents, development, music production, anything.

## The GUI

The GUI sits above the engine. It is not bound to a single shell — it can manage multiple engines, each with its own peers, packages, and scope. The immediate shape: a single-window application with internal tiling, scope navigation, and first-class substrate interaction.

## UI From Type Contracts

Invocables don't build UI. They declare typed inputs. The system resolves each type to a UI module:

- **Scope** — a multi-select navigator with completion, expansion, history
- **Prompt** — a text input with undo, redo, history, multi-line
- Any chunk selection (session, adapter, etc.) is scope — same mechanism

A different invocable needing different types gets different modules automatically. The UI is derived from the type contract, not built per invocable. These modules are reusable across everything.

## Visual Scope

**Views are scopes.** Each open view is a deterministic scope — a set of chunks at an intersection. Open another scope, get another view. Narrow a scope, get a filtered view. You don't lose context by narrowing — you open another view alongside.

**Tiling.** Views tile within the application. Multiple scopes visible simultaneously.

**Example flow.** You scope to a session — all chunks in order, a scrollable list. You filter to just prompt + answer — that's another view alongside the first, not a replacement. You filter to tool-call — a third view. Each view is a scope, each scope is deterministic, and you haven't lost any of them by narrowing.

**Agent scope vs visual scope.** What you see (your views, your lenses) and what the agent receives as context are distinct. You control both. You might be viewing tool calls while the agent's context includes the full session plus knowledge scope.

**Scope pinning.** Pinned scopes are fixed in the agent's context — culture, core knowledge. The agent reads them but can't remove them. Changing a pinned scope requires approval (like a tool call). Unpinned scopes the agent manages freely.

## The Broader Vision — Forming

**Window manager.** The single-window app is the starting point. The broader vision: a scope-based window manager that manages everything — not just substrate views, but any program that exposes structure as scope. URLs decompose into scope segments. History as chunks enables completion. Spatial navigation — views positioned in scope space, layout reflecting structural proximity.

**A visual substrate.** The tiling manager may be something deeper than an OS window manager — purpose-agnostic, resonating with the database layer and the type system. You could build a DAW from this, a VJ program, anything. This is not proven but the intuition is strong.

## Implementation Paths — Not Decided

Options charted from exploration. Each has different strengths; none is chosen.

- **Tauri + Svelte** — Tauri as thin application container, Svelte as the UI layer. Strongest DX for the single-window app. Svelte's compiler-driven reactivity fits a pure view layer (engine owns all state, UI reflects it). WebGL/WebGPU available inline via `<canvas>`.
- **Tauri + Leptos** — Rust frontend compiled to WASM in the webview. Shared types with a Rust/Zig engine. More syntax overhead but no language boundary.
- **iced (Rust, Elm architecture)** — native rendering, no webview. COSMIC desktop proves iced + Smithay can drive a Wayland compositor on Linux. Elm architecture aligns with the substrate's principles (deterministic state, explicit mutations, pure views). A path to a native compositor, but more upfront work for the single-window app.
- **wgpu** — the GPU abstraction underlying iced. Foundation for custom rendering if needed. Cross-platform including WebGPU/WASM.

The compositor is a future evolution. The single-window app is the immediate goal. The engine language, the container, and the UI framework are all open. These are options, not decisions.

## What's Open

- Whether the single-window app or a TTY shell comes first
- Rendering tech decision
- How programs concretely expose their innards as scope (protocol, adapters)
- The exact tiling/layout model
- How spatial scope positioning works in practice
- Whether the WM evolves from the app or is built separately
- How deep visual graph navigation goes vs list/tree views
