# Shell Exploration

The shell is an engine. Not a bash replacement — a layer on top of the OS that manages scope, type contracts, invocable dispatch, and context assembly. It delegates to the OS for actual command execution. Scope replaces the working directory. Programs take typed interfaces.

The engine works with two systems: the substrate (a database) and the normal filesystem. It unifies both — you scope and invoke across both worlds. The interaction model (scope, invoke, navigate) is independent of rendering — a TTY, a GUI, or an API can drive the same engine. See `interface.md` for the visual layer.

This is an active exploration. Concepts range from settled to speculative.

## Why It Matters

Structurally another take on today's operating system model — delivered pragmatically, without shipping a new OS or VM tech. Scope replaces the working directory. Type contracts replace string arguments. The substrate replaces the filesystem as the structural foundation for knowledge.

Unix's revolution: small programs, one job each, compose through pipes and files. Today's programs are monolithic — agent tools, IDEs, DAWs, browsers all bundle everything internally. You can't swap parts, you can't compose across them.

The shell breaks that apart through **scope-based composition**. Modules compose by being in scope together. Type contracts (via the substrate's spec system) let modules declare what they need. The shell resolves it. Swap any piece — change one module.

The agent case is founding — it's what revealed the need. Context is the portal to the raw power of LLMs, and controlling what fills the context window is what the scope model enables. But the shell ought to support various cases. Cases are concrete stories to simulate and compare against.

### Context Assembly — The Agent Case

Context assembly is fully declarative and composable:

```
culture (always in context)
+ session history (chunks with placements — scopeable, filterable)
+ knowledge scope (whatever you've scoped to in ())
+ prompt
= the full context sent to the model
```

You control all of it. Session history isn't a black box — it's chunks with placements. You can scope, filter, derive, exclude:

- Exclude tool calls from session context
- Derive a filtered scope from a session (strip sensitive info, extract only decisions)
- Merge two sessions into one context
- Take a 200-turn session and create a scope of just the architectural decisions
- Send different scopes of the same knowledge to different models

The underlying CLI (Claude, Codex, etc.) would be invoked in a bare mode — seeing exactly what the shell assembles, nothing more. The CLI is a completion engine. The shell controls the context. (Aspirational — current CLIs don't expose this level of control.)

## Two Scope Channels — Emerging

Like PATH and PWD, but for scope. Illustrative syntax (not decided):

```
[agents/core agents/claude] (my-org board people) :: tell . "who takes most decisions?"
 ^^^^^^^^^^^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 invocable scope              knowledge scope           invocation
```

**`[]` — Invocable scope (like PATH).** What's available to call. Modules with programs and capabilities. Their packages are installed, their invocables are findable. Changing `[]` adds/removes capabilities without polluting your knowledge context.

**`()` — Knowledge scope (like PWD).** Where you are, what you're looking at. Substrate scopes AND real filesystem paths. This is what `.` passes as context, what `sum` summarizes. Changing `()` moves your focus without changing what tools are available.

An invocable in `[]` reads its own database for internal knowledge (interface, config, how to invoke). The user's `()` is what gets passed as context. Invocables don't see each other's internal knowledge unless explicitly passed.

## Shell Interaction — Emerging

```
[invocable scope] (knowledge scope) :: command args
```

- The prompt shows both scopes
- `::` separates L1 (standard shell) from L2 (scoped invocation)
- `.` means "current knowledge scope content"
- Invocables receive scope specification and query the database themselves — they decide what to read and how much
- L1 and L2 can mix in pipes — invocables are just commands

### L1 / L2 — emerging concept

- **L1 — standard shell.** Everything without `::`. `ls`, `cat`, `git`, `vim` — normal operation on the real filesystem.
- **L2 — scoped invocation.** After `::`. Scope-based resolution, type contracts, context assembly. Invocables are still just commands — they participate in pipes with L1.

The L1/L2 boundary depends on how type contracts work, which depends on the substrate's spec system. The concept (two layers of invocation) is clear; the exact mechanics are open.

## `sum` as Primary Navigation — Emerging

`sum` (summary) is more natural than `ls` for navigating scope. It summarizes ALL chunks in scope — the summary cannot lose insight. Shows both substrate chunks and real files:

```
[...] (plugin/src/hooks) :: sum

chunks: 12
related: (implementation, lifecycle)
outliers: (...)

A summary of ALL content in this scope

files:
- post-prompt.cljs
```

Knowledge scope unifies substrate scopes AND real filesystem paths. Scoping to a real directory like `plugin/src/hooks` shows both the files there and the substrate chunks that relate to it via integration. `sum` orients you — `ls` is the low-level fallback.

Cached summaries (keyed to scope + commit_id + model) support this — the substrate's commit model gives perfect cache invalidation.

## Integration: Substrate and Filesystem

A file reference is a chunk placed on the scopes where it's relevant. Its body contains resolution parameters — at minimum a path, plus anchoring information.

**Git as first integration driver.** If the referenced file is git-tracked, the substrate commit and the git commit together pin the reference in time. An agent or caretaker can later reconcile: what git commits have touched this file since the reference was made? If the file changed, is the surrounding knowledge still aligned? The substrate stores the fact; the intelligence evaluates it.

Multiple integration types exist — files, API endpoints, audio, video. Each has its own archetype defining required fields (path + commit for git, endpoint + method for REST, etc.). Each has its own resolution logic. The pattern is uniform: a chunk whose body contains resolution parameters, whose archetype defines the contract.

File references don't mirror filesystem hierarchy. The substrate's placement structure reflects knowledge relationships. The file sits where it sits on disk. The reference chunk sits where it's meaningful in the substrate.

**Filesystem paths in scope.** When a filesystem path is added to knowledge scope, and reference chunks connect that path to substrate chunks, the path functions as a placement — not in the database, but in the shell's scope resolution. The reference chunk is the hinge, placed on substrate scopes and pointing to a filesystem path. The shell resolves the bridge transparently.

### FUSE — deprioritized

FUSE would present the substrate as a filesystem, bridging to Unix tools that only understand files. Inside the shell, this bridge isn't needed — the shell already speaks substrate natively. Programs use the shell language or an SDK. `ol` works directly on the host without FUSE. May have value for tools that fundamentally expect file paths. Not needed to start.

Design concept preserved: path segments are scopes (the path IS the query), POSIX operations map to substrate operations, same chunk through different paths = same inode. Filesystem scope is hierarchical, substrate scope is set intersection — the shell could unify both in `()`.

## Invocables and Type Contracts — Emerging

The substrate's spec system enables typed invocation. An invocable declares what it needs through its type contract. The shell resolves contracts at invocation time: matching what the invocable needs against what's in scope.

### Shell language for invocables

`sh` is the only scripting language guaranteed on Unix without installing packages. But our shell has more power than `sh` for this domain — it speaks the substrate natively. Invocables for the shell can be written in the shell language itself, with no need for external languages or SDKs.

Services (long-running processes) are different — they may need real languages with proper concurrency and error handling. But shell invocables cover the invocation surface.

### Type resolution

The shell resolves invocations by type, not by explicit naming. `tell "question"` works when a session is in knowledge scope and an adapter is in invocable scope — the shell resolves both. No need to specify `tell claude "question"` if there's only one adapter in scope. The contract lives in the substrate (archetypes, specs). The shell matches supply to demand.

### Contract resolution

- **The substrate** holds archetypes, specs, what exists and where it's placed
- **The shell** matches invocable requirements against what's in scope at invocation time
- **The invocable** receives resolved inputs and does its work

### The agents example — emerging

`agents/core` defines archetypes:
- **session** — spec: `{ ordered: true, accepts: ["prompt", "answer", "tool-call", "knowledge-update"] }`. A sequence of agent interaction events.
- **adapter** — an archetype for invocables that map a general agent interface to a specific CLI.

`agents/claude` is a concrete adapter:
- Instance of the `adapter` archetype
- Depends on `claude-code` package with config
- Assembles context from knowledge scope
- Invokes the CLI in bare mode (aspirational) — the shell controls all context, the CLI is just a completion engine
- Stores prompt and response as chunks placed on the session with seq ordering

`agents/codex` would be the same adapter type with different CLI mapping. The archetype is the abstraction; the CLI mapping is the implementation.

### Code as derivation — foundational

The substrate holds knowledge and contracts. Code is derived from that knowledge — generated by agents of the system. This is foundational to why this project exists: knowledge first, code derived. The code is a mirror of understanding, never the source of truth. Reverse testing verifies purity: regenerate the code from knowledge alone — if it still works, the knowledge is complete. If not, something was in the code that wasn't captured in knowledge.

This dissolves the friction between specs in the substrate and types in code. If agents generate the invocable code from substrate knowledge, the types in the generated code come from the same substrate the agent read. There's no sync problem, no codegen machinery, no two sources of truth.

The boundary between substrate and code exists — languages need types at development time, not just at runtime. But this boundary is naturally addressed when the authoring happens in the substrate and the code is the output.

**What's NOT yet specified:** How session creation works as a shell command. How the adapter concretely receives and returns data. The exact invocable script format.

## Peers and Spawn — Settled Concepts

A peer is any directory with a `.db` file — at any depth. The filesystem hierarchy is just organization on the host. A monorepo can contain multiple peers as subdirectories.

```
culture/
  culture.db
agents/                 # just a directory — a monorepo grouping
  core/
    core.db             # session archetype, adapter archetype
    src/
  claude/
    claude.db           # claude interface, peers: [core]
    packages.edn        # declares: needs claude-code + config
    src/
my-project/
  project.db
  code/
  peers.edn             # declares: I depend on culture, agents/core, agents/claude
```

Package declarations (`packages.edn`) and peer declarations (`peers.edn`) are files in the directory, not in the database.

### VM mounting

**The entry point is the containment boundary.** The directory you start from is read-write. Everything peered in from outside is read-only. Nesting can only reduce access.

```
shell my-project                     # project is rw, peers are ro
shell culture --mount my-project     # culture is rw, project is ro (ad-hoc)
shell parent-dir/                    # everything inside is rw
```

Two ways peers enter the VM:
1. **Declared** — in the directory's `peers.edn`. Always mounted.
2. **Ad-hoc** — specified at launch. Temporary, not persisted.

The spawner (on the host) resolves peer names to paths. Inside the VM, peers are flat mounted directories.

**Without a VM:** The `.db` is still usable via `ol` directly on the host. Data is never locked in.

### Packages — emerging

Each directory can declare packages it needs (`packages.edn`) with configuration. An invocable carries its own dependencies — adding `agents/claude` to your invocable scope makes claude-code available with its default config. You can override per-invocation.

## Research

Declarative model findings, atomic filesystem history, stress tests (agent collaboration, piping across boundaries), and the biology mapping are in `research/shell-research.md`.

## Agent Case — Emerging

The founding case for the shell. An agent session grounded in substrate primitives.

**Session flow:**
1. Start the shell: `shell my-project` — project is rw, declared peers (culture, agents/core, agents/claude) mount ro
2. Create a session: `new session "debugging scope query"` — a chunk placed on the `session` archetype
3. Invoke: `tell "why is the scope query returning duplicates?"` — shell resolves adapter from invocable scope, assembles context (culture + session history + knowledge scope + prompt), invokes
4. Each turn becomes chunks: prompt placed on session (seq: N) and on `prompt` (instance), response placed on session (seq: N+1) and on `answer` (instance). Tool calls, knowledge updates — same pattern.

**Agent scope vs visual scope.** What the agent receives as context and what the user sees are distinct. The user controls both but they can differ. The user might be viewing tool calls while the agent's context includes the full session plus knowledge scope.

**Scope pinning.** Pinned scopes are fixed in the agent's context — culture, core knowledge. The agent reads them but can't remove them. Changing a pinned scope requires approval (like a tool call). Unpinned scopes the agent manages freely — dropping what's irrelevant, adding what it discovers.

## What Is Forming — Thoughts, Not Settled

- `[]` as PATH (invocable findability), `()` as PWD (knowledge context) — the Unix analogy
- `.` as "current knowledge scope content" — implicit context passing
- `sum` as primary navigation — summarizes ALL chunks in scope, not just listing
- Scope modifiers (`:fuzzy` for neighbouring scopes, `. - scope-name` for exclusion, session filtering)
- Whether invocables are greedy (take all scope) or require explicit `.`
- Per-invocation config override (invocable carries defaults, you override)
- Whether the engine requires the VM or can run standalone (the VM adds containment; the engine may be usable without it)
- Multiple scope targets showing merged views
- Services (daemons) — side-effect/purity implications
- Shell language design — the language needs to be expressive enough for real invocable logic
- Scope-dependent package installation (scoping a sub-module installs only its packages)

## What Is Open — Genuinely Unknown

- Exact scope query syntax (characters, modifiers, composition)
- How `cd` works — scope change, filesystem navigation, or both depending on target
- How temporal depth (lookback) is presented to the user
- The exact invocable script format and how invocables are structured in peer directories
- Package mechanism details — how configuration works, resolution, installation timing
- Export/import format for git-tracking substrate databases

## Culture

- **Discovery over invention** — the system already exists. We uncover it.
- **Ground before building** — hold unknowns open. Say "don't know yet."
- **Simplicity and naturalness** — if it feels forced, it's wrong.
- **Culture first** — identity and values ground everything.
- **Easy to use, beginner friendly, no lock-in** — open for all folk.
- **Context is power** — control over what fills the context window. Everything serves this.
