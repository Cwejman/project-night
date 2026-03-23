# TUI Specification — `olb`

Interactive terminal interface for navigating an OpenLight knowledge base.

## What It Is

A read-only terminal UI for scope navigation. The CLI answers one question per invocation (`ol scope culture`); the TUI keeps a session open — you move through the dimensional space interactively.

- Not a dashboard, not a replacement for the CLI, not a web browser
- Agents use the CLI (JSON). Humans use the TUI.
- Read-only. No writes in scope.

## Layout

Two panels, both visible by default, equal-width split of terminal.

- **Top bar:** Branch name (gray) + scope dimensions (colored) + aggregate chunk count.
- **Dimensions panel** (left): Connected dimensions as a vertical list, sorted by connection strength. Each entry shows:
  - Colored dimension name + shared count
  - AI-generated summary (short in light text, extended in gray via toggle)
  - Sub-connections (other connected dims with counts, wrapping to panel width)
  - Outlier/edge dimensions shown dimmer
  - Scope summary at the top of the panel, scrolls with content
- **Chunk panel** (right): Shows chunks for the current view.
  - Updates as cursor moves over dims — shows chunks at scope ∩ focused dim.
  - Text content wraps to panel width. KV pairs as clean key/value table.
  - Each chunk shows memberships (instance/relates dims, colored).
- **Bottom bar:** Context-sensitive keybind hints. Changes during drop/pull/branch/toggle modes.

## Keybindings

| Key | Action |
|-----|--------|
| `j`/`k` | Move cursor up/down |
| `l` | Enter element (inside dim: navigate sub-dims) |
| `h` | Exit element / switch instance↔relates inside |
| `tab` | Switch focus between dims and chunks panels |
| `a` | Add focused dim to scope |
| `d` | Drop mode — numbered scope dims, digit to drop |
| `p` | Pull mode — type dimension name, enter to add |
| `b` | Branch mode — numbered branch list, digit to switch |
| `t` | Toggle mode — sub-keys: `d`ims, `c`hunks, `s`ummary detail |
| `u`/`r` | Undo/redo scope history |
| `q` | Quit |

## Navigation Model

Three levels of depth:

**Entry level** — `j`/`k` between dim entries. `tab` switches panel focus. `h` is no-op.

**Inside a dim entry** — `l` to enter. `h`/`l` switches instance/relates. `j`/`k` navigates sub-dims. `a` adds sub-dim to scope. `h` at instance exits to entry level.

**Inside a chunk** — same pattern with membership dims.

**Scrolling:** Cursor moves freely within viewport. Viewport shifts only when cursor entry leaves the visible area.

**Scope rules:** Add narrows, drop widens. Only scope mutations push to history stack.

## AI Summaries

Two-tier system with caching:

**Dim summaries** — generated once per HEAD commit. One `claude -p --model haiku` call produces summaries for all dimensions. Seeded with `{culture}` scope chunks as system context plus full scope structure and chunks. Cached by HEAD in `.openlight/cache/summaries/`. Scope-independent — reused instantly across scope changes.

**Scope summaries** — generated per scope+HEAD combination. Lightweight call for the scope-level overview. Cached in memory (per session).

**Summary format:** Each summary has a short (one sentence, displayed in light text) and long (expanding paragraph, displayed in gray). Toggle between them with `t`→`s`.

## System Discovery

On startup, walks upward from cwd to find `.openlight/`. Uses `--db` flag for all `ol` calls. Reads active branch from `.openlight/config.json`. Cache stored in `.openlight/cache/`.

## Data Source

Separate Go binary that shells out to `ol` commands. No shared library, no direct DB access.

## Implementation

- **Language:** Go + bubbletea + lipgloss
- **Location:** `browser/` directory (separate Go module)
- **Binary:** `olb`, installed via `make install` → `/usr/local/bin/olb`
- **Colors:** Deterministic per dim name (FNV-1a hash, 16-color palette)
- **Panel width:** Equal split — `(terminal_width - gap) / 2`

## Open (Post-MVP)

- Pull completion (fuzzy search)
- Per-dimension last-affected commit for finer cache invalidation
- Write operations
- History browsing within the TUI
- Browser-specific peered knowledge system for description context
- Configurable model for summaries
