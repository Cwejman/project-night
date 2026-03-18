# Implementation Process — `ol` CLI

How we build. The agent architecture for implementation.

## Principles

- **TDD.** Tests first, then implementation. Tests are the specification made executable. A failing test is a requirement; a passing test is a proven requirement.
- **Incremental.** Build the smallest working thing, then extend. Each increment is a commit that works.
- **Simplify after each step.** Implementation tends to accumulate complexity. After each feature is working, a simplification pass removes what isn't needed.
- **The spec is the truth.** `specification.md` defines what to build. Implementation questions that the spec doesn't answer should be resolved by updating the spec first, then building.

## Agent Roles

### Architect (sequential, before implementation begins)
- Reads the specification
- Produces the project skeleton: `build.zig`, directory structure, SQLite amalgamation setup, dependency acquisition (zig-clap)
- Verifies the skeleton compiles and runs a trivial test
- One agent, one time, at the start

### Implementer (sequential per feature)
- Takes one feature at a time from the build order
- Writes failing tests first (from the spec)
- Implements until tests pass
- Commits working code

### Simplifier (sequential, after each feature)
- Reviews the code the Implementer produced
- Removes unnecessary abstraction, dead code, over-engineering
- Ensures the code is the simplest thing that passes the tests
- Does not add features — only subtracts complexity

### Verifier (sequential, after Simplifier)
- Runs the full test suite
- Checks edge cases the Implementer may have missed
- Writes additional tests if gaps are found
- Confirms the feature is solid before moving to the next

## Build Order

Each step is a complete TDD cycle: test → implement → simplify → verify.

1. **Project skeleton.** Zig project, SQLite compiled in, builds and runs. Trivial "hello world" test passes.

2. **`ol init`.** Creates the database, initializes schema, creates `main` branch with root commit. Test: init creates a valid `.db` file with the correct tables.

3. **`ol apply` — create chunks.** Parse declarative JSON with new chunks. Insert chunk_versions, dimension_versions, membership_versions. Generate IDs. Create commit. Test: apply JSON with new chunks, verify they exist in the database.

4. **`ol dims`.** List dimensions with instance/relates/total counts. Test: after applying chunks, dims returns correct counts.

5. **`ol scope` — structural read.** Scope query returning dimensions with shared counts, instance/relates split, connections. No chunks. Test: apply known data, verify scope returns correct structural JSON.

6. **`ol scope --chunks`.** Add chunk content to scope response. Flat list, full membership. Test: verify chunks appear with correct membership.

7. **`ol apply` — update chunks.** Parse mutations with existing chunk IDs. Compute membership diff. Insert version rows. Test: apply update, verify new version exists, old version preserved.

8. **`ol apply` — remove chunks.** Parse `removed: true`. Insert version row with removed=1. Test: removed chunk doesn't appear in scope, version history preserved.

9. **`ol log`.** Walk commit DAG, return history. Test: after multiple applies, log returns commits in order.

10. **`ol show`.** Compare version rows at a commit against its parent. Generate declarative JSON diff. Test: show returns the correct mutation for a known commit.

11. **`ol diff`.** Compare resolved state at two commits. Compose into declarative JSON. Test: diff between two known states returns correct composed mutation.

12. **`ol branch create/switch/list/delete`.** Branch pointer management. State resolution from ancestry on switch. Test: create branch, apply on branch, switch back, verify states are independent.

13. **`ol scope` — edges.** Dimensions beyond scope reach, inside bridging dimensions. Test: verify edges appear correctly for known data.

14. **`ol scope` — empty scope.** All dimensions with top-N connections. Test: empty scope returns full dimensional map.

15. **`--at` flag.** Time travel on read operations. Resolve state at a historical commit. Test: apply, apply again, read at first commit, verify old state.

16. **`--format human`.** Human-readable output for TTY. Test: verify output format switches based on flag.

## Parallelism

Most steps are sequential — each builds on the previous. However:

- Steps 9-11 (log, show, diff) are independent of each other and can be built in parallel after step 8.
- Step 16 (human format) is independent of everything after step 5 and can be built in parallel.

## How Agents Are Used

- **One agent per TDD cycle.** The agent receives: the spec, the current codebase, and the specific step to implement. It writes tests, implements, and returns working code.
- **Simplifier is a separate agent** with a different prompt: "make this simpler without breaking tests." It has no permission to add features.
- **Verifier is a separate agent** with permission to add tests but not change implementation.
- **The main conversation orchestrates.** It decides when to move to the next step, resolves spec questions, and maintains alignment.

## Zig Setup

Before step 1, Zig must be installed. The Architect agent handles:
- Installing Zig (or verifying it's installed)
- Downloading SQLite amalgamation (`sqlite3.c` + `sqlite3.h`)
- Setting up `build.zig` to compile SQLite into the binary
- Adding zig-clap as a dependency
- Verifying `zig build` succeeds
