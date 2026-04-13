import type { Db } from './db.ts'
import { getActiveBranch, getHead } from './db.ts'
import type {
  ChunkItem,
  Commit,
  ConnectedScope,
  Placement,
  ScopeConnection,
  ScopeResult,
} from './types.ts'

const parseChunkRow = (
  row: { chunk_id: string; name: string | null; spec: string; body: string },
  placements: Placement[],
): ChunkItem => ({
  id: row.chunk_id,
  name: row.name ?? undefined,
  spec: JSON.parse(row.spec),
  body: JSON.parse(row.body),
  placements,
})

const getPlacementsForChunk = (db: Db, chunkId: string, branch: string): Placement[] =>
  db
    .query<
      { chunk_id: string; scope_id: string; type: string; seq: number | null },
      [string, string]
    >(
      'SELECT chunk_id, scope_id, type, seq FROM current_placements WHERE chunk_id = ? AND branch = ?',
    )
    .all(chunkId, branch)
    .map((row) => ({
      chunk_id: row.chunk_id,
      scope_id: row.scope_id,
      type: row.type as 'instance' | 'relates',
      seq: row.seq ?? undefined,
    }))

const getChunkItem = (db: Db, chunkId: string, branch: string): ChunkItem | null => {
  const row = db
    .query<
      { chunk_id: string; name: string | null; spec: string; body: string },
      [string, string]
    >('SELECT chunk_id, name, spec, body FROM current_chunks WHERE chunk_id = ? AND branch = ?')
    .get(chunkId, branch)
  if (!row) return null
  return parseChunkRow(row, getPlacementsForChunk(db, chunkId, branch))
}

const getInScopeChunkIds = (db: Db, scopeIds: string[], branch: string): string[] => {
  if (scopeIds.length === 1) {
    return db
      .query<{ chunk_id: string }, [string, string]>(
        `SELECT chunk_id FROM current_placements WHERE scope_id = ? AND branch = ?`,
      )
      .all(scopeIds[0]!, branch)
      .map((r) => r.chunk_id)
  }

  const placeholders = scopeIds.map(() => '?').join(', ')
  const params = [...scopeIds, branch, scopeIds.length]
  return (
    db
      .prepare(
        `SELECT chunk_id FROM current_placements
       WHERE scope_id IN (${placeholders}) AND branch = ?
       GROUP BY chunk_id
       HAVING COUNT(DISTINCT scope_id) = ?`,
      )
      .all(...params) as { chunk_id: string }[]
  ).map((r) => r.chunk_id)
}

const countInstanceRelates = (
  db: Db,
  chunkIds: string[],
  scopeIds: string[],
  branch: string,
): { instance: number; relates: number } => {
  if (chunkIds.length === 0) return { instance: 0, relates: 0 }

  const chunkPlaceholders = chunkIds.map(() => '?').join(', ')
  const scopePlaceholders = scopeIds.map(() => '?').join(', ')

  const rows = db
    .prepare(
      `SELECT type, COUNT(*) as cnt FROM current_placements
       WHERE chunk_id IN (${chunkPlaceholders})
         AND scope_id IN (${scopePlaceholders})
         AND branch = ?
       GROUP BY type`,
    )
    .all(...chunkIds, ...scopeIds, branch) as {
    type: string
    cnt: number
  }[]

  let instance = 0
  let relates = 0
  for (const row of rows) {
    if (row.type === 'instance') instance = row.cnt
    else relates = row.cnt
  }
  return { instance, relates }
}

const queryConnectedScopes = (
  db: Db,
  inScopeChunkIds: string[],
  scopeIds: string[],
  branch: string,
): ConnectedScope[] => {
  if (inScopeChunkIds.length === 0) return []

  const chunkPlaceholders = inScopeChunkIds.map(() => '?').join(', ')
  const scopeSet = new Set(scopeIds)

  // Find all scopes that in-scope chunks are also placed on (excluding the query scopes)
  const dimRows = db
    .prepare(
      `SELECT cp.scope_id, cp.type, COUNT(DISTINCT cp.chunk_id) as cnt
       FROM current_placements cp
       WHERE cp.chunk_id IN (${chunkPlaceholders})
         AND cp.branch = ?
       GROUP BY cp.scope_id, cp.type
       ORDER BY cp.scope_id`,
    )
    .all(...inScopeChunkIds, branch) as {
    scope_id: string
    type: string
    cnt: number
  }[]

  // Aggregate by scope_id, excluding the query scopes
  const scopeMap = new Map<string, { instance: number; relates: number }>()
  for (const row of dimRows) {
    if (scopeSet.has(row.scope_id)) continue
    const existing = scopeMap.get(row.scope_id) ?? {
      instance: 0,
      relates: 0,
    }
    if (row.type === 'instance') existing.instance = row.cnt
    else existing.relates = row.cnt
    scopeMap.set(row.scope_id, existing)
  }

  // Find connections between connected scopes
  const connectedIds = [...scopeMap.keys()]
  const connectionMap = new Map<
    string,
    Map<string, { instance: number; relates: number }>
  >()

  if (connectedIds.length > 1) {
    const connPlaceholders = connectedIds.map(() => '?').join(', ')
    const connRows = db
      .prepare(
        `SELECT cp1.scope_id as s1, cp2.scope_id as s2, cp2.type, COUNT(DISTINCT cp1.chunk_id) as cnt
         FROM current_placements cp1
         JOIN current_placements cp2 ON cp1.chunk_id = cp2.chunk_id AND cp1.branch = cp2.branch
         WHERE cp1.chunk_id IN (${chunkPlaceholders})
           AND cp1.scope_id IN (${connPlaceholders})
           AND cp2.scope_id IN (${connPlaceholders})
           AND cp1.scope_id != cp2.scope_id
           AND cp1.branch = ?
         GROUP BY cp1.scope_id, cp2.scope_id, cp2.type`,
      )
      .all(...inScopeChunkIds, ...connectedIds, ...connectedIds, branch) as {
      s1: string
      s2: string
      type: string
      cnt: number
    }[]

    for (const row of connRows) {
      if (!connectionMap.has(row.s1)) connectionMap.set(row.s1, new Map())
      const inner = connectionMap.get(row.s1)!
      const existing = inner.get(row.s2) ?? { instance: 0, relates: 0 }
      if (row.type === 'instance') existing.instance = row.cnt
      else existing.relates = row.cnt
      inner.set(row.s2, existing)
    }
  }

  // Build results, resolve names, sort by shared count
  const results: ConnectedScope[] = connectedIds
    .map((scopeId) => {
      const counts = scopeMap.get(scopeId)!
      const shared = counts.instance + counts.relates

      const nameRow = db
        .query<
          { name: string | null },
          [string, string]
        >('SELECT name FROM current_chunks WHERE chunk_id = ? AND branch = ?')
        .get(scopeId, branch)

      const conns: ScopeConnection[] = []
      const innerMap = connectionMap.get(scopeId)
      if (innerMap) {
        for (const [connId, connCounts] of innerMap) {
          const connName = db
            .query<
              { name: string | null },
              [string, string]
            >('SELECT name FROM current_chunks WHERE chunk_id = ? AND branch = ?')
            .get(connId, branch)
          conns.push({
            id: connId,
            name: connName?.name ?? undefined,
            instance: connCounts.instance,
            relates: connCounts.relates,
          })
        }
      }

      return {
        id: scopeId,
        name: nameRow?.name ?? undefined,
        shared,
        instance: counts.instance,
        relates: counts.relates,
        connections: conns,
      }
    })
    .sort((a, b) => b.shared - a.shared)

  return results
}

export const COMMITS_SCOPE = '__commits'

const handleCommitsScope = (
  db: Db,
  scopeIds: string[],
  branch: string,
  head: string,
): ScopeResult => {
  const totalRow = db
    .query<{ cnt: number }, [string]>(
      'SELECT COUNT(*) as cnt FROM current_chunks WHERE branch = ?',
    )
    .get(branch)
  const total = totalRow?.cnt ?? 0

  const filterIds = scopeIds.filter((id) => id !== COMMITS_SCOPE)

  type CommitRow = {
    id: string
    parent_id: string | null
    timestamp: string
    dispatch_id: string | null
  }

  let commits: CommitRow[]

  if (filterIds.length === 0) {
    // All commits
    commits = db
      .query<CommitRow, []>('SELECT id, parent_id, timestamp, dispatch_id FROM commits')
      .all()
  } else {
    // Intersection with another scope id
    const filterId = filterIds[0]!

    // Check if filterId is a dispatch: commits reference it as dispatch_id
    const hasDispatchCommits = db
      .query<{ cnt: number }, [string]>(
        'SELECT COUNT(*) as cnt FROM commits WHERE dispatch_id = ?',
      )
      .get(filterId)

    const chunkExists = db
      .query<{ cnt: number }, [string, string]>(
        'SELECT COUNT(*) as cnt FROM current_chunks WHERE chunk_id = ? AND branch = ?',
      )
      .get(filterId, branch)

    if (chunkExists && chunkExists.cnt > 0 && hasDispatchCommits && hasDispatchCommits.cnt > 0) {
      // Filter by dispatch_id
      commits = db
        .query<CommitRow, [string]>(
          'SELECT id, parent_id, timestamp, dispatch_id FROM commits WHERE dispatch_id = ?',
        )
        .all(filterId)
    } else {
      // Filter by chunk_versions — commits that touched this chunk
      commits = db
        .query<CommitRow, [string]>(
          `SELECT DISTINCT c.id, c.parent_id, c.timestamp, c.dispatch_id
           FROM commits c
           JOIN chunk_versions cv ON c.id = cv.commit_id
           WHERE cv.chunk_id = ?`,
        )
        .all(filterId)
    }
  }

  const items: ChunkItem[] = commits.map((c) => ({
    id: c.id,
    name: undefined,
    spec: {},
    body: {
      parent_id: c.parent_id,
      timestamp: c.timestamp,
      dispatch_id: c.dispatch_id,
    },
    placements: [
      { chunk_id: c.id, scope_id: COMMITS_SCOPE, type: 'instance' as const },
    ],
  }))

  // Connected scopes: each unique dispatch_id
  const connected: ConnectedScope[] = []
  const dispatchIds = new Set<string>()
  for (const c of commits) {
    if (c.dispatch_id) dispatchIds.add(c.dispatch_id)
  }
  for (const did of dispatchIds) {
    const nameRow = db
      .query<{ name: string | null }, [string, string]>(
        'SELECT name FROM current_chunks WHERE chunk_id = ? AND branch = ?',
      )
      .get(did, branch)
    const count = commits.filter((c) => c.dispatch_id === did).length
    connected.push({
      id: did,
      name: nameRow?.name ?? undefined,
      shared: count,
      instance: count,
      relates: 0,
      connections: [],
    })
  }
  connected.sort((a, b) => b.shared - a.shared)

  const virtualScope: ChunkItem = {
    id: COMMITS_SCOPE,
    name: 'commits',
    spec: {},
    body: { text: 'Commit history' },
    placements: [],
  }

  return {
    scope: [virtualScope],
    head,
    chunks: {
      total,
      in_scope: items.length,
      instance: items.length,
      relates: 0,
      items,
    },
    connected,
  }
}

export const scope = (db: Db, scopeIds: string[]): ScopeResult => {
  const branch = getActiveBranch(db)
  const head = getHead(db, branch) ?? 'root'

  if (scopeIds.includes(COMMITS_SCOPE)) {
    return handleCommitsScope(db, scopeIds, branch, head)
  }

  const totalRow = db
    .query<
      { cnt: number },
      [string]
    >('SELECT COUNT(*) as cnt FROM current_chunks WHERE branch = ?')
    .get(branch)
  const total = totalRow?.cnt ?? 0

  if (scopeIds.length === 0) {
    return {
      scope: [],
      head,
      chunks: { total, in_scope: total, instance: 0, relates: 0, items: [] },
      connected: [],
    }
  }

  // Get the scope chunks themselves
  const scopeChunks = scopeIds
    .map((id) => getChunkItem(db, id, branch))
    .filter((c): c is ChunkItem => c !== null)

  // Get in-scope chunk IDs
  const inScopeIds = getInScopeChunkIds(db, scopeIds, branch)

  // Count instance vs relates
  const ir = countInstanceRelates(db, inScopeIds, scopeIds, branch)

  // Get full chunk items
  const items = inScopeIds
    .map((id) => getChunkItem(db, id, branch))
    .filter((c): c is ChunkItem => c !== null)

  // Get connected scopes
  const connected = queryConnectedScopes(db, inScopeIds, scopeIds, branch)

  return {
    scope: scopeChunks,
    head,
    chunks: {
      total,
      in_scope: inScopeIds.length,
      instance: ir.instance,
      relates: ir.relates,
      items,
    },
    connected,
  }
}

export const search = (db: Db, query: string): ChunkItem[] => {
  const branch = getActiveBranch(db)

  const rows = db
    .query<
      { chunk_id: string },
      [string]
    >(`SELECT chunk_id FROM chunk_fts WHERE chunk_fts MATCH ?`)
    .all(query)

  return rows
    .map((row) => getChunkItem(db, row.chunk_id, branch))
    .filter((c): c is ChunkItem => c !== null)
}

export const log = (db: Db, limit: number = 50): Commit[] => {
  const branch = getActiveBranch(db)
  const head = db
    .query<{ head: string }, [string]>('SELECT head FROM branches WHERE name = ?')
    .get(branch)

  if (!head) return []

  const commits: Commit[] = []
  let currentId: string | null = head.head

  while (currentId && commits.length < limit) {
    const row = db
      .query<
        { id: string; parent_id: string | null; timestamp: string; dispatch_id: string | null },
        [string]
      >('SELECT id, parent_id, timestamp, dispatch_id FROM commits WHERE id = ?')
      .get(currentId)

    if (!row) break

    commits.push({
      id: row.id,
      parent_id: row.parent_id,
      timestamp: row.timestamp,
      dispatch_id: row.dispatch_id,
    })

    currentId = row.parent_id
  }

  return commits
}
