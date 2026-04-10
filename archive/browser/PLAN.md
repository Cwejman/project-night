# Browser Implementation Plan

`olb` — Go + bubbletea TUI for navigating OpenLight knowledge bases.

## Build Order

Each step produces a working binary. Tests at every step.

### Step 1: Skeleton

- Go module at `browser/`, deps: bubbletea, lipgloss, bubbles
- Makefile: `build`, `test`, `install` (→ `/usr/local/bin/olb`), `clean`
- `main.go` starts a bubbletea program, displays placeholder, quits on `q`
- **Test:** `go build`, `go test`, run `olb` and quit

### Step 2: System Discovery

- Walk upward from cwd to find `.openlight/`
- Store path, derive `--db` flag for all `ol` calls
- Error state: "No .openlight/ found. Run `ol init`."
- **Test:** unit test with temp dirs at various depths, edge case at `/`

### Step 3: Basic Rendering

- Go structs matching `ol scope` JSON (ScopeResponse, ScopeDim, ChunkItem, etc.)
- `ol scope --db <path> --format json` execution and parsing
- Render: top bar (scope + counts), dims list (name, shared count, sub-connections, outliers in gray), bottom bar (keybinds)
- Positional color assignment from a palette
- **Test:** JSON parsing unit tests with known strings, render unit tests, integration test against `ol` binary

### Step 4: Navigation

- Cursor state, `j`/`k` movement, clamping at boundaries
- `▸` indicator on focused entry
- Viewport scrolling when list exceeds terminal height
- Terminal resize handling (`tea.WindowSizeMsg`)
- **Test:** model tests — send key sequences, assert cursor position

### Step 5: Scope Changes

- `a` (add): add focused dim to scope, re-fetch
- `d` (drop mode): bottom bar shows numbered scope dims, digit drops, non-digit cancels
- `p` (pull mode): bottom bar becomes text input, enter adds, ESC cancels
- Mode state in model: `normal`, `drop`, `pull`
- Loading indicator (spinner) during `ol` calls
- **Test:** model tests for each mode, integration test with real scope changes

### Step 6: Split View

- Chunks panel: `ol scope <dims> --chunks`, render text + kv table + memberships
- `tab` switches panel focus (only when both visible)
- `t` toggles inactive panel visibility
- Side-by-side layout: left ~48 chars, gap 5, right fills remaining
- Chunk panel updates on cursor movement (scope ∩ focused dim)
- Empty states: no panels → centered text, chunks only → full width
- **Test:** layout width calculation, panel toggle state transitions, chunk rendering

### Step 7: Inside-Element Navigation

- `l` enters a dim entry or chunk
- Inside dim: `h`/`l` toggles instance/relates, `j`/`k` navigates sub-dims, `a` adds sub-dim to scope, `h` at instance exits
- Inside chunk: same pattern with membership dims
- Nav level state: `entry`, `insideDim`, `insideChunk`
- Context-sensitive bottom bar updates per level
- **Test:** model tests for all level transitions, entry/exit, add from inside

### Step 8: AI Summaries

- Cache: `.openlight/tui-cache` (JSON), key = sorted scope dims + HEAD commit
- Culture: `ol scope bootstrap --chunks` → system prompt file
- Generation: `claude -p` with `--system-prompt-file`, `--model sonnet`, `--max-turns 1`
- Parallel with concurrency cap (e.g., 5)
- Loading indicator per entry, cached entries instant
- Scope summary + per-dimension summaries, same pipeline
- **Test:** cache unit tests (put/get/miss/invalidation), mock `claude` for integration

### Step 9: History Stack

- Stack of scope states, pointer for current position
- Push on scope mutations only (add/drop/pull), not cursor moves
- `u` undoes (moves pointer back, re-fetches), `r` redoes
- Truncates redo history on new mutation
- **Test:** unit tests for push/undo/redo/truncation, model tests for full flow

## Dependencies

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
                  ↘ 9 (parallel with 6)
```

## Testing Strategy

**Unit tests** (fast, every change):
- JSON parsing, cache logic, history stack, render functions
- Bubbletea model: call `model.Update(msg)` directly, assert state

**Integration tests** (gated behind build tag):
- Create temp `.openlight/` via `ol init` + `ol apply`
- Run `ol` commands and verify parsed results
- Mock `claude` for summary tests

**Visual verification** (during development):
- Render `model.View()` → pipe through `aha --black` → HTML → playwright screenshot
- Same pipeline used for the mockup — proven to work
- Not a test suite, a development feedback loop

## Project Structure

```
browser/
├── go.mod
├── go.sum
├── Makefile
├── PLAN.md
├── main.go           — entry point, system discovery
├── model.go          — bubbletea Model (state, Update, View)
├── ol/
│   ├── exec.go       — shell out to ol
│   ├── types.go      — Go structs for ol JSON
│   └── parse_test.go
├── ui/
│   ├── layout.go     — panel layout, split view
│   ├── dims.go       — dimensions panel
│   ├── chunks.go     — chunks panel
│   ├── topbar.go
│   ├── bottombar.go
│   └── styles.go     — lipgloss styles
├── cache/
│   ├── cache.go
│   └── cache_test.go
└── nav/
    ├── history.go
    └── history_test.go
```
