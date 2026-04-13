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

/**
 * Collect the composed spec for a scope by walking its archetype chain.
 * The scope's own spec is composed with specs from every archetype it is
 * an instance of (union for accepts, required, unique; any ordered wins).
 * Each archetype's accepts names are resolved within that archetype's scope
 * and returned as resolved IDs alongside the raw spec.
 */
const collectSpecs = (
  db: Db,
  scopeId: string,
  branch: string,
): {
  ordered: boolean
  required: string[]
  unique: string[]
  acceptedTypeIds: string[]
  acceptedNames: Map<string, string>
} => {
  const ownSpec = getSpec(db, scopeId, branch)

  // Gather specs: own (if not propagating) + propagating specs from archetypes
  const specs: { spec: Spec; scopeId: string }[] = []

  // Own spec is enforced on direct children only if it's NOT propagate
  // (propagate means the spec is for instances' children, not own children)
  if (!ownSpec.propagate) {
    specs.push({ spec: ownSpec, scopeId })
  }

  // Walk archetype chain recursively with cycle detection
  const visited = new Set<string>()
  const queue = [scopeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const archetypeRows = db
      .query<{ scope_id: string }, [string, string]>(
        `SELECT scope_id FROM current_placements
         WHERE chunk_id = ? AND branch = ? AND type = 'instance'`,
      )
      .all(current, branch)

    for (const row of archetypeRows) {
      const archetypeSpec = getSpec(db, row.scope_id, branch)
      if (archetypeSpec.propagate) {
        specs.push({ spec: archetypeSpec, scopeId: row.scope_id })
      }
      if (!visited.has(row.scope_id)) {
        queue.push(row.scope_id)
      }
    }
  }

  // Compose
  let ordered = false
  const required: string[] = []
  const unique: string[] = []
  const acceptedTypeIds: string[] = []
  const acceptedNames = new Map<string, string>()

  for (const { spec, scopeId: specScopeId } of specs) {
    if (spec.ordered) ordered = true

    if (spec.required) {
      for (const key of spec.required) {
        if (!required.includes(key)) required.push(key)
      }
    }

    if (spec.unique) {
      for (const key of spec.unique) {
        if (!unique.includes(key)) unique.push(key)
      }
    }

    if (spec.accepts) {
      acceptedNames.set(specScopeId, spec.accepts.join(','))
      for (const name of spec.accepts) {
        const typeId = resolveNameInScope(db, name, specScopeId, branch)
        if (typeId && !acceptedTypeIds.includes(typeId)) {
          acceptedTypeIds.push(typeId)
        }
      }
    }
  }

  return { ordered, required, unique, acceptedTypeIds, acceptedNames }
}

export const isOrderedScope = (
  db: Db,
  scopeId: string,
  branch: string,
): boolean => {
  return collectSpecs(db, scopeId, branch).ordered
}

export const enforce = (
  db: Db,
  chunk: ChunkDeclaration & { readonly id: string },
  placement: PlacementDeclaration,
  branch: string,
): void => {
  // Spec enforcement only applies to instance placements
  if (placement.type !== 'instance') return

  const composed = collectSpecs(db, placement.scope_id, branch)

  // Quick exit if nothing to enforce
  if (
    !composed.ordered &&
    composed.required.length === 0 &&
    composed.unique.length === 0 &&
    composed.acceptedTypeIds.length === 0
  ) {
    return
  }

  if (composed.ordered && placement.seq == null) {
    throw new SpecViolation(
      `Placement on ordered scope ${placement.scope_id} requires seq`,
    )
  }

  if (composed.acceptedTypeIds.length > 0) {
    const matchCount = composed.acceptedTypeIds.filter((typeId) =>
      isInstanceOf(db, chunk.id, typeId, branch),
    ).length

    if (matchCount === 0) {
      throw new SpecViolation(
        `Chunk ${chunk.id} is not an instance of an accepted type on scope ${placement.scope_id}`,
      )
    }
    if (matchCount > 1) {
      throw new SpecViolation(
        `Chunk ${chunk.id} matches multiple accepted types on scope ${placement.scope_id}`,
      )
    }
  }

  if (composed.required.length > 0) {
    const body = chunk.body ?? {}
    for (const key of composed.required) {
      if (!(key in body)) {
        throw new SpecViolation(
          `Missing required key "${key}" for scope ${placement.scope_id}`,
        )
      }
    }
  }

  if (composed.unique.length > 0) {
    const body = chunk.body ?? {}
    for (const key of composed.unique) {
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
