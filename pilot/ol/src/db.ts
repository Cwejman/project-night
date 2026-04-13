import { Database } from 'bun:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS commits (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT,
    timestamp   TEXT NOT NULL,
    dispatch_id TEXT
);

CREATE TABLE IF NOT EXISTS branches (
    name TEXT PRIMARY KEY,
    head TEXT NOT NULL REFERENCES commits(id)
);

CREATE TABLE IF NOT EXISTS chunk_versions (
    chunk_id  TEXT NOT NULL,
    commit_id TEXT NOT NULL REFERENCES commits(id),
    name      TEXT,
    spec      TEXT NOT NULL DEFAULT '{}',
    body      TEXT NOT NULL DEFAULT '{}',
    removed   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chunk_id, commit_id)
);

CREATE TABLE IF NOT EXISTS placement_versions (
    chunk_id  TEXT NOT NULL,
    scope_id  TEXT NOT NULL,
    type      TEXT NOT NULL CHECK (type IN ('instance', 'relates')),
    seq       INTEGER,
    active    INTEGER NOT NULL DEFAULT 1,
    commit_id TEXT NOT NULL REFERENCES commits(id),
    PRIMARY KEY (chunk_id, scope_id, commit_id)
);

CREATE TABLE IF NOT EXISTS current_chunks (
    chunk_id  TEXT NOT NULL,
    branch    TEXT NOT NULL,
    name      TEXT,
    spec      TEXT NOT NULL DEFAULT '{}',
    body      TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (chunk_id, branch)
);

CREATE TABLE IF NOT EXISTS current_placements (
    chunk_id  TEXT NOT NULL,
    scope_id  TEXT NOT NULL,
    branch    TEXT NOT NULL,
    type      TEXT NOT NULL,
    seq       INTEGER,
    PRIMARY KEY (chunk_id, scope_id, branch)
);

CREATE INDEX IF NOT EXISTS idx_pv_scope ON placement_versions(scope_id, type);
CREATE INDEX IF NOT EXISTS idx_pv_chunk ON placement_versions(chunk_id);
CREATE INDEX IF NOT EXISTS idx_cv_chunk ON chunk_versions(chunk_id, commit_id);
CREATE INDEX IF NOT EXISTS idx_cp_scope ON current_placements(scope_id, branch);

CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
    chunk_id,
    name,
    body
);
`

const SEED = `
INSERT INTO commits (id, parent_id, timestamp, dispatch_id) VALUES ('root', NULL, datetime('now'), NULL);
INSERT INTO branches (name, head) VALUES ('main', 'root');
`

export type Db = Database

export const open = (path: string = ':memory:'): Db => {
  const db = new Database(path)
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)

  const hasRoot = db.query('SELECT 1 FROM commits WHERE id = ?').get('root')
  if (!hasRoot) {
    db.exec(SEED)
  }

  return db
}

export const getHead = (db: Db, branch: string = 'main'): string | null => {
  const row = db
    .query<{ head: string }, [string]>('SELECT head FROM branches WHERE name = ?')
    .get(branch)
  return row?.head ?? null
}

export const getActiveBranch = (_db: Db): string => {
  // For now, always 'main'. Config-based branch switching comes later.
  return 'main'
}
