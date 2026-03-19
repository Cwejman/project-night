# OpenLight CLI Specification — `ol`

Implementation specification. Built in Zig with SQLite. Single static binary.

## 1. Data Model

**Chunk** — a unit of meaning.
- `id`: string (system-generated, unique)
- `text`: string (required)
- `kv`: key/value pairs (optional)

**Dimension** — a named phenomenon.
- `name`: string (unique, primary identifier)

**Membership** — binary relation between chunk and dimension.
- `chunk_id`, `dimension`, `type` (`instance` | `relates`)
- Unique per (chunk_id, dimension)

**Commit** — atomic point in history.
- `id`: string (unique)
- `parent_id`: string | null (previous commit — forms a DAG)
- `timestamp`: ISO 8601

**Branch** — a movable pointer to a commit.
- `name`: string (unique)
- `head`: commit id

### Constraints

- A chunk must have at least one membership.
- Dimensions are created implicitly when first referenced.
- Removing a chunk is lossless — marked removed, preserved in history.
- Membership fields in a mutation are the complete set for that chunk.
- Commits have no branch field. A commit exists in the DAG; branches are labels pointing into it. A commit reachable from multiple branches is not duplicated.

## 2. SQLite Schema

### Versioned Tables (Source of Truth)

Every mutation produces version rows tagged with the commit that created them. History IS the versioned rows. No JSON copies, no event logs. The building blocks are the truth.

```sql
CREATE TABLE commits (
    id TEXT PRIMARY KEY,
    parent_id TEXT,               -- NULL for root commit. Forms a DAG.
    timestamp TEXT NOT NULL
);

CREATE TABLE branches (
    name TEXT PRIMARY KEY,
    head TEXT NOT NULL             -- commit id this branch points to
);

CREATE TABLE chunk_versions (
    chunk_id TEXT NOT NULL,
    commit_id TEXT NOT NULL REFERENCES commits(id),
    text TEXT NOT NULL,
    kv TEXT DEFAULT '{}',
    removed INTEGER DEFAULT 0,
    PRIMARY KEY (chunk_id, commit_id)
);

CREATE TABLE membership_versions (
    chunk_id TEXT NOT NULL,
    dimension TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('instance', 'relates')),
    active INTEGER NOT NULL DEFAULT 1,
    commit_id TEXT NOT NULL REFERENCES commits(id),
    PRIMARY KEY (chunk_id, dimension, commit_id)
);

CREATE INDEX idx_mv_dimension ON membership_versions(dimension, type);
CREATE INDEX idx_mv_chunk ON membership_versions(chunk_id);
CREATE INDEX idx_cv_chunk ON chunk_versions(chunk_id, commit_id);
```

### Current State Resolution

1. Start at the branch's HEAD commit.
2. Walk parent pointers to root, collecting commit IDs (the ancestry).
3. For each entity, its current version is the row with the most recent commit_id in that ancestry.

At expected scale, this is fast. A materialized current-state cache can be maintained in memory and updated on each commit — but the version tables remain the source of truth.

### Diffing

Compare resolved state at two commits. The diff is computed from native versioned rows, not stored. The declarative JSON output is generated from the truth, not stored as the truth.

## 3. Write Operation — `ol apply`

Single write command. Input: declarative JSON. Output: commit id.

### Mutation JSON (CLI Interface Format)

```json
{
  "chunks": [
    {
      "text": "The summer youth program...",
      "kv": {"status": "active"},
      "instance": ["community-programs", "projects"],
      "relates": ["education", "people"]
    },
    {
      "id": "c_019",
      "text": "revised understanding...",
      "instance": ["projects", "design"],
      "relates": ["people"]
    },
    {
      "id": "c_005",
      "removed": true
    }
  ]
}
```

This is the interface format. It is NOT stored as-is. The system translates it into native versioned rows.

### Apply Algorithm

Within a single SQLite transaction:

1. Create a new commit row (generate id, parent = current branch HEAD, timestamp).

2. For each chunk in the mutation:

   **New chunk** (no `id`):
   - Generate unique chunk_id
   - Validate: at least one membership
   - Insert `chunk_versions` row
   - Insert `membership_versions` rows (active=1)
   - Dimensions are implicit — they exist when memberships reference them

   **Update** (has `id`, no `removed`):
   - Resolve current state of chunk from ancestry
   - If `text` or `kv` changed: insert new `chunk_versions` row
   - If `instance`/`relates` provided: compare against current memberships
     - New: insert `membership_versions` (active=1)
     - Removed: insert `membership_versions` (active=0)
     - Type changed: insert `membership_versions` with new type
   - Fields not provided: no version rows inserted

   **Remove** (`removed: true`):
   - Insert `chunk_versions` row with removed=1

3. Advance branch HEAD to the new commit.

4. Commit SQLite transaction. All succeed or all fail.

## 4. Read Operations

### `ol scope [dimensions...] [flags]`

The primary read. Structure by default, content opt-in via `--chunks`.

**Flags:**
- `--chunks` — include chunk content
- `--at <commit-id>` — historical state
- `--format json|human` — json if piped, human if TTY
- `--limit <n>` — max chunks (with `--chunks`)
- `--instance` / `--relates` — filter by membership type

**Algorithm:**

1. Resolve current state on active branch.
2. In-scope chunks: those with membership on ALL scoped dimensions.
3. Connected dimensions: for each dimension NOT in scope, count in-scope chunks that have membership on it. Split by instance/relates on that dimension.
4. Connections: between connected dimensions, among shared chunks. Instance/relates split.
5. Edges: dimensions connected to connected dimensions but not to the scope. Inside the bridging dimension.
6. With `--chunks`: flat list of in-scope chunks, each with full membership.

**Empty scope:** all dimensions listed with top-N connections.

### Response Format

```json
{
  "scope": ["culture"],
  "chunks": { "total": 12, "in_scope": 7, "instance": 5, "relates": 2 },
  "dimensions": [
    {
      "name": "projects",
      "shared": 5, "instance": 0, "relates": 5,
      "connections": [
        { "dim": "people", "instance": 3, "relates": 1 }
      ],
      "edges": [
        { "dim": "finance", "instance": 3, "relates": 2 }
      ]
    }
  ]
}
```

With `--chunks`, `chunks.items` is populated as a flat list. Each chunk once, full membership. Instance/relates visible at every level.

### `ol dims`

Lightweight listing. No connectivity.

```json
{
  "dimensions": [
    { "name": "culture", "instance": 5, "relates": 2, "total": 7 }
  ]
}
```

### `ol show <commit-id>`

Shows what changed by comparing versioned rows at this commit against its parent. Output as declarative JSON — generated from native rows.

### `ol diff <a> <b>`

Compares resolved state at two commits. Returns composed declarative JSON. Generated, not stored.

### `ol log [flags]`

Commit history. Walks parent pointers from branch HEAD.

**Flags:** `--limit <n>`, `--branch <name>`, `--chunk <id>`, `--dim <name>`

Summary per commit computed from version rows.

## 5. Branch Operations

### `ol branch create <name>`
Creates a pointer to the current HEAD commit. Nothing else.

### `ol branch switch <name>`
Writes the active branch to `.openlight/config.json`. Active branch is client state — the database stores no session information. Different clients can be on different branches simultaneously.

### `ol branch list`
Lists branches with their HEAD commit ids.

### `ol branch delete <name>`
Removes the pointer. Commits and version rows remain (lossless). Cannot delete main or the active branch.

## 6. Initialization

### `ol init`
Creates `.openlight/` directory in the current working directory containing:
- `system.db` — SQLite database with schema and root commit on `main`
- `config.json` — client settings (`{"branch": "main"}`)

## 7. Global Flags

| Flag | Description |
|------|-------------|
| `--db <path>` | Database path. Default: `.openlight/system.db` or `$OPENLIGHT_DB` |
| `--branch <name>` | Active branch. Default: from `.openlight/config.json` or `$OPENLIGHT_BRANCH` or `main` |
| `--format json\|human` | json if piped, human if TTY |
| `--at <commit-id>` | Time travel (read operations) |

## 8. Output Format

**JSON for writes** (`ol apply` input). Agents generate JSON most reliably. Constrained decoding guarantees validity.

**JSON for reads** (default machine format). The ecosystem standard — every provider (Anthropic, OpenAI, Google), every protocol (MCP), every agent-native CLI converges on JSON for structured tool output. Benchmarked: YAML is 23% more token-efficient and scores higher on LLM comprehension, but JSON's universality and generation reliability outweigh the savings.

**Format detection:** `--format json` if piped, `--format human` if TTY. Follows the `gh` CLI pattern — the established agent-native CLI convention.

**The real token savings come from response shaping, not format choice.** Structural-by-default (dimensions + connectivity, no chunk content unless `--chunks`) saves far more tokens than any format optimization. An agent bootstraps from zero to full structural understanding in ~3,200 tokens vs ~50,000 for reading all content. This design choice dominates format efficiency.

**Error output:** `{"error": "message"}` with non-zero exit code. Errors to stderr when in human format.

## 9. Implementation Notes

### Technology
- Zig + SQLite amalgamation. Single static binary.
- zig-clap for CLI. std.json for JSON. SQLite via raw C API.

### ID Generation
- Unique strings. Format decided during implementation.

### Error Handling
- Validate before mutating. Transaction rollback on failure.

### Deferred
- Peers (excluded from v1)
- Roaring Bitmaps (optimize if needed)
- Branch merging (not a system operation — diffing is built)
- Full-text search (FTS5 available, not v1)
- Views (not settled)
- Commit messages (open question)
- Compact/token-optimized output format (add if JSON proves wasteful in practice)
