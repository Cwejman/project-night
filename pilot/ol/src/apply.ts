import type { Db } from './db.ts'
import { getHead, getActiveBranch } from './db.ts'
import { generateId } from './id.ts'
import { enforce, isOrderedScope, SpecViolation } from './spec.ts'
import type { ApplyResult, Declaration } from './types.ts'

const extractFtsText = (body: Record<string, unknown>): string => {
  const strings: string[] = []
  const walk = (val: unknown): void => {
    if (typeof val === 'string') strings.push(val)
    else if (Array.isArray(val)) val.forEach(walk)
    else if (val && typeof val === 'object') Object.values(val).forEach(walk)
  }
  walk(body)
  return strings.join(' ')
}

export const apply = (
  db: Db,
  declaration: Declaration,
  options?: { dispatch?: string },
): ApplyResult => {
  const branch = getActiveBranch(db)
  const parentId = getHead(db, branch)

  if (!parentId) {
    throw new Error(`Branch "${branch}" has no HEAD`)
  }

  const commitId = generateId()
  const timestamp = new Date().toISOString()
  const results: { id: string; created: boolean }[] = []

  db.run('BEGIN IMMEDIATE')

  try {
    db.run(
      'INSERT INTO commits (id, parent_id, timestamp, dispatch_id) VALUES (?, ?, ?, ?)',
      [commitId, parentId, timestamp, options?.dispatch ?? null],
    )

    for (const entry of declaration.chunks) {
      const chunkId = entry.id ?? generateId()
      const exists = db
        .query<{ chunk_id: string }, [string, string]>(
          'SELECT chunk_id FROM current_chunks WHERE chunk_id = ? AND branch = ?',
        )
        .get(chunkId, branch)
      const created = !exists

      if (entry.removed) {
        // Soft remove
        const current = db
          .query<
            { name: string; spec: string; body: string },
            [string, string]
          >('SELECT name, spec, body FROM current_chunks WHERE chunk_id = ? AND branch = ?')
          .get(chunkId, branch)

        db.run(
          `INSERT INTO chunk_versions (chunk_id, commit_id, name, spec, body, removed)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [
            chunkId,
            commitId,
            current?.name ?? null,
            current?.spec ?? '{}',
            current?.body ?? '{}',
          ],
        )

        db.run('DELETE FROM current_chunks WHERE chunk_id = ? AND branch = ?', [
          chunkId,
          branch,
        ])

        // Remove from FTS
        db.run('DELETE FROM chunk_fts WHERE chunk_id = ?', [chunkId])

        results.push({ id: chunkId, created: false })
        continue
      }

      if (created) {
        // Create new chunk
        const spec = JSON.stringify(entry.spec ?? {})
        const body = JSON.stringify(entry.body ?? {})

        db.run(
          `INSERT INTO chunk_versions (chunk_id, commit_id, name, spec, body, removed)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [chunkId, commitId, entry.name ?? null, spec, body],
        )

        db.run(
          `INSERT INTO current_chunks (chunk_id, branch, name, spec, body)
           VALUES (?, ?, ?, ?, ?)`,
          [chunkId, branch, entry.name ?? null, spec, body],
        )

        // FTS
        const ftsText = extractFtsText(entry.body ?? {})
        db.run('INSERT INTO chunk_fts (chunk_id, name, body) VALUES (?, ?, ?)', [
          chunkId,
          entry.name ?? '',
          ftsText,
        ])
      } else {
        // Update existing chunk
        const current = db
          .query<
            { name: string; spec: string; body: string },
            [string, string]
          >('SELECT name, spec, body FROM current_chunks WHERE chunk_id = ? AND branch = ?')
          .get(chunkId, branch)

        const name = entry.name !== undefined ? entry.name : (current?.name ?? null)
        const spec =
          entry.spec !== undefined ? JSON.stringify(entry.spec) : (current?.spec ?? '{}')
        const body =
          entry.body !== undefined ? JSON.stringify(entry.body) : (current?.body ?? '{}')

        db.run(
          `INSERT OR REPLACE INTO chunk_versions (chunk_id, commit_id, name, spec, body, removed)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [chunkId, commitId, name, spec, body],
        )

        db.run(
          `INSERT OR REPLACE INTO current_chunks (chunk_id, branch, name, spec, body)
           VALUES (?, ?, ?, ?, ?)`,
          [chunkId, branch, name, spec, body],
        )

        // Update FTS
        db.run('DELETE FROM chunk_fts WHERE chunk_id = ?', [chunkId])
        const bodyObj = entry.body ?? (current ? JSON.parse(current.body) : {})
        const ftsText = extractFtsText(bodyObj as Record<string, unknown>)
        db.run('INSERT INTO chunk_fts (chunk_id, name, body) VALUES (?, ?, ?)', [
          chunkId,
          name ?? '',
          ftsText,
        ])
      }

      // Two-pass placement processing per chunk:
      // Pass 1: Write all placements (with seq auto-assignment). No enforcement.
      // Pass 2: Run enforce() + name uniqueness on all non-removed placements.
      const placements = entry.placements ?? []
      const resolvedSeqs: (number | null)[] = []

      // Pass 1: Write
      for (const placement of placements) {
        if (placement.removed) {
          // Soft remove placement
          db.run(
            `INSERT INTO placement_versions (chunk_id, scope_id, type, seq, active, commit_id)
             VALUES (?, ?, ?, ?, 0, ?)`,
            [chunkId, placement.scope_id, placement.type, placement.seq ?? null, commitId],
          )

          db.run(
            'DELETE FROM current_placements WHERE chunk_id = ? AND scope_id = ? AND branch = ?',
            [chunkId, placement.scope_id, branch],
          )

          resolvedSeqs.push(null)
          continue
        }

        let seq = placement.seq ?? null

        // Seq auto-assignment for ordered scopes
        if (seq === null && placement.type === 'instance') {
          if (isOrderedScope(db, placement.scope_id, branch)) {
            const maxRow = db
              .query<{ max_seq: number | null }, [string, string]>(
                `SELECT MAX(seq) as max_seq FROM current_placements
                 WHERE scope_id = ? AND branch = ?`,
              )
              .get(placement.scope_id, branch)
            seq = (maxRow?.max_seq ?? 0) + 1
          }
        }

        resolvedSeqs.push(seq)

        db.run(
          `INSERT INTO placement_versions (chunk_id, scope_id, type, seq, active, commit_id)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [chunkId, placement.scope_id, placement.type, seq, commitId],
        )

        db.run(
          `INSERT OR REPLACE INTO current_placements (chunk_id, scope_id, branch, type, seq)
           VALUES (?, ?, ?, ?, ?)`,
          [chunkId, placement.scope_id, branch, placement.type, seq],
        )
      }

      // Pass 2: Enforce specs + name uniqueness (skip removed placements)
      const chunkWithId = { ...entry, id: chunkId }
      for (let i = 0; i < placements.length; i++) {
        const placement = placements[i]!
        if (placement.removed) continue

        const seq = resolvedSeqs[i]!

        // Enforce with the resolved seq so ordered check sees the auto-assigned value
        enforce(db, chunkWithId, { ...placement, seq: seq ?? undefined }, branch)

        // Name uniqueness per scope
        if (chunkWithId.name != null) {
          const duplicate = db
            .query<{ chunk_id: string }, [string, string, string, string]>(
              `SELECT cp.chunk_id FROM current_placements cp
               JOIN current_chunks cc ON cc.chunk_id = cp.chunk_id AND cc.branch = cp.branch
               WHERE cp.scope_id = ? AND cp.branch = ? AND cc.name = ? AND cp.chunk_id != ?`,
            )
            .get(placement.scope_id, branch, chunkWithId.name, chunkId)

          if (duplicate) {
            throw new SpecViolation(
              `Duplicate name "${chunkWithId.name}" on scope ${placement.scope_id}`,
            )
          }
        }
      }

      results.push({ id: chunkId, created })
    }

    // Advance branch HEAD
    db.run('UPDATE branches SET head = ? WHERE name = ?', [commitId, branch])

    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }

  return {
    commit: { id: commitId, parent_id: parentId, timestamp },
    chunks: results,
  }
}
