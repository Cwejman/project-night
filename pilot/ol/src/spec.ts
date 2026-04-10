import type { Db } from './db.ts'
import type { ChunkDeclaration, PlacementDeclaration, Spec } from './types.ts'

export class SpecViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpecViolation'
  }
}

const getSpec = (db: Db, scopeId: string, branch: string): Spec => {
  const row = db
    .query<
      { spec: string },
      [string, string]
    >('SELECT spec FROM current_chunks WHERE chunk_id = ? AND branch = ?')
    .get(scopeId, branch)
  return row ? (JSON.parse(row.spec) as Spec) : {}
}

const isInstanceOf = (
  db: Db,
  chunkId: string,
  typeId: string,
  branch: string,
): boolean => {
  const row = db
    .query<{ chunk_id: string }, [string, string, string]>(
      `SELECT chunk_id FROM current_placements
       WHERE chunk_id = ? AND scope_id = ? AND branch = ? AND type = 'instance'`,
    )
    .get(chunkId, typeId, branch)
  return row !== null
}

const resolveNameInScope = (
  db: Db,
  name: string,
  scopeId: string,
  branch: string,
): string | null => {
  const row = db
    .query<{ chunk_id: string }, [string, string, string]>(
      `SELECT cp.chunk_id FROM current_placements cp
       JOIN current_chunks cc ON cc.chunk_id = cp.chunk_id AND cc.branch = cp.branch
       WHERE cp.scope_id = ? AND cp.branch = ? AND cc.name = ?`,
    )
    .get(scopeId, branch, name)
  return row?.chunk_id ?? null
}

export const enforce = (
  db: Db,
  chunk: ChunkDeclaration & { readonly id: string },
  placement: PlacementDeclaration,
  branch: string,
): void => {
  const spec = getSpec(db, placement.scope_id, branch)

  if (Object.keys(spec).length === 0) return

  // Spec enforcement only applies to instance placements
  if (placement.type !== 'instance') return

  if (spec.ordered && placement.seq == null) {
    throw new SpecViolation(
      `Placement on ordered scope ${placement.scope_id} requires seq`,
    )
  }

  if (spec.accepts) {
    // If the chunk's name matches an accepted type name, it's a type definition — skip
    const chunkName =
      chunk.name ??
      db
        .query<
          { name: string | null },
          [string, string]
        >('SELECT name FROM current_chunks WHERE chunk_id = ? AND branch = ?')
        .get(chunk.id, branch)?.name

    if (!chunkName || !spec.accepts.includes(chunkName)) {
      const accepted = spec.accepts
        .map((name) => resolveNameInScope(db, name, placement.scope_id, branch))
        .filter((id): id is string => id !== null)

      const isAccepted = accepted.some((typeId) =>
        isInstanceOf(db, chunk.id, typeId, branch),
      )

      if (!isAccepted) {
        throw new SpecViolation(
          `Chunk ${chunk.id} is not an instance of an accepted type on scope ${placement.scope_id}`,
        )
      }
    }
  }

  if (spec.required) {
    const body = chunk.body ?? {}
    for (const key of spec.required) {
      if (!(key in body)) {
        throw new SpecViolation(
          `Missing required key "${key}" for scope ${placement.scope_id}`,
        )
      }
    }
  }

  if (spec.unique) {
    const body = chunk.body ?? {}
    for (const key of spec.unique) {
      if (!(key in body)) continue
      const value = JSON.stringify(body[key])

      const existing = db
        .query<{ chunk_id: string }, [string, string, string]>(
          `SELECT cp.chunk_id FROM current_placements cp
           JOIN current_chunks cc ON cc.chunk_id = cp.chunk_id AND cc.branch = cp.branch
           WHERE cp.scope_id = ? AND cp.branch = ? AND cp.type = 'instance'
             AND cp.chunk_id != ?`,
        )
        .all(placement.scope_id, branch, chunk.id)

      for (const row of existing) {
        const existingChunk = db
          .query<
            { body: string },
            [string, string]
          >('SELECT body FROM current_chunks WHERE chunk_id = ? AND branch = ?')
          .get(row.chunk_id, branch)

        if (existingChunk) {
          const existingBody = JSON.parse(existingChunk.body) as Record<string, unknown>
          if (JSON.stringify(existingBody[key]) === value) {
            throw new SpecViolation(
              `Duplicate value for unique key "${key}" on scope ${placement.scope_id}`,
            )
          }
        }
      }
    }
  }
}
