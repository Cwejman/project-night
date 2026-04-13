# Pilot

The first end-to-end proof. Chunks go in, programs run against them, a person sees what happened. Four pieces: a substrate library (`ol`), an engine that manages dispatch and containment, a UI, and an agent loop. The lib owns the database. The engine mediates all invocable access to it. The UI is the human surface. The invocable runs sandboxed.

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
- **File integration.** Invocable executables as tracked references. Deferred for the pilot.
- **System prompt vs manufactured history.** Both structurally supported; the choice is empirical.
- **Per-dispatch VM isolation.** Interesting direction but not realistic for the pilot.

## Build Order

1. **`ol`** — substrate library + CLI. Done.
2. **[Bootstrap](pilot/bootstrap.md)** — seed script.
3. **[Engine](pilot/engine.md)** — dispatch, boundaries, VM, invocable protocol, lifecycle.
4. **[UI](pilot/ui.md)** scaffold — SvelteKit app with binary tree tiling.
5. **[UI](pilot/ui.md)** command palette + selector.
6. **[UI](pilot/ui.md)** read tile.
7. **[UI](pilot/ui.md)** dispatch tile. Calls the engine.
8. **[Agent](pilot/agent.md)** — claude invocable. Communicates with engine via protocol.

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
  engine/          — dispatch, boundaries, VM, protocol (host side) + client (invocable side)
  ui/              — SvelteKit app
  project/         — the working project (ol init target)
    .ol/db         — the substrate database
    invocables/    — claude, filesystem, shell, web (run in VM)
```

**VM packaging.** The VM is stateless — invocable code is mounted read-only via virtio-fs. `.env` for configuration (API keys). A setup script installs runtime dependencies. Reproducible environments come later.

---

## Specs

[`substrate.md`](pilot/substrate.md) — the substrate contract. Chunk, placement, spec language, history, queries. Implementation: [`pilot/ol/`](pilot/ol/).

[`engine.md`](pilot/engine.md) — the engine. Dispatch, boundaries, invocable protocol, VM, lifecycle, tool-call dispatch.

[`agent.md`](pilot/agent.md) — the claude agent. Session types, context/pinning, the cycle, tool specs, API mapping, sub-agents, culture, knowledge serialization.

[`ui.md`](pilot/ui.md) — the UI. Tiling, read/dispatch tiles, components, command palette, selector.

[`bootstrap.md`](pilot/bootstrap.md) — the seed data. One apply() call.
