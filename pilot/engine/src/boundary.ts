import { scope } from '../../ol/src/index.ts'
import type { Db } from '../../ol/src/types.ts'
import type { DispatchContext } from './types.ts'

/**
 * Check if a target scope is reachable from any boundary root
 * by walking instance placements upward. BFS with cycle detection.
 */
export const isReachable = (
  db: Db,
  targetScopeId: string,
  boundaryRoots: readonly string[],
): boolean => {
  if (boundaryRoots.length === 0) return false
  const rootSet = new Set(boundaryRoots)
  if (rootSet.has(targetScopeId)) return true

  // BFS: walk instance placements of the target upward
  const visited = new Set<string>()
  const queue = [targetScopeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    // Get all instance placements of this chunk — the scopes it's placed on
    const result = scope(db, [current])
    if (result.scope.length === 0) continue
    const chunk = result.scope[0]!

    for (const placement of chunk.placements) {
      if (placement.type !== 'instance') continue
      if (rootSet.has(placement.scope_id)) return true
      if (!visited.has(placement.scope_id)) {
        queue.push(placement.scope_id)
      }
    }
  }

  return false
}

/**
 * Read the boundary scope references from a dispatch's boundary container.
 * Boundary scope refs are placed as 'relates' on the boundary container.
 */
const readBoundaryRoots = (
  db: Db,
  dispatchId: string,
  boundaryTypeId: string,
): string[] => {
  const result = scope(db, [dispatchId])
  const container = result.chunks.items.find((c) =>
    c.placements.some((p) => p.scope_id === boundaryTypeId && p.type === 'instance'),
  )
  if (!container) return []

  const containerScope = scope(db, [container.id])
  return containerScope.chunks.items.map((c) => c.id)
}

/**
 * Compute the effective boundary by intersecting the invocable's
 * intrinsic boundary with the dispatch-level boundary.
 */
const computeEffectiveBoundary = (
  db: Db,
  invocableId: string,
  dispatchBoundaryRoots: readonly string[],
  dispatchId: string,
): readonly string[] => {
  // Read invocable's intrinsic boundary
  const invResult = scope(db, [invocableId])
  const invocable = invResult.scope[0]
  const intrinsic = (invocable?.body as Record<string, unknown>)?.boundary as string | undefined

  if (intrinsic === 'open' || intrinsic === undefined) {
    // Universal set — effective = dispatch-level
    return dispatchBoundaryRoots
  }

  if (intrinsic === 'dispatch') {
    // Intrinsic is dispatch scope only — effective is just dispatch
    // (intersection of dispatch-only with anything = dispatch-only)
    return [dispatchId]
  }

  // Future: support explicit intrinsic boundary root lists
  return dispatchBoundaryRoots
}

/**
 * Build a DispatchContext from a dispatch ID. Reads boundary containers
 * and computes effective boundaries.
 */
export const buildDispatchContext = (
  db: Db,
  dispatchId: string,
  invocableId: string,
): DispatchContext => {
  const dispatchReadRoots = readBoundaryRoots(db, dispatchId, 'read-boundary')
  const dispatchWriteRoots = readBoundaryRoots(db, dispatchId, 'write-boundary')

  const effectiveReadRoots = computeEffectiveBoundary(
    db, invocableId, dispatchReadRoots, dispatchId,
  )
  const effectiveWriteRoots = computeEffectiveBoundary(
    db, invocableId, dispatchWriteRoots, dispatchId,
  )

  // Collect protected chunk IDs: dispatch chunk + boundary containers
  const protectedIds = new Set<string>([dispatchId])
  const result = scope(db, [dispatchId])
  for (const item of result.chunks.items) {
    if (
      item.placements.some(
        (p) =>
          (p.scope_id === 'read-boundary' || p.scope_id === 'write-boundary') &&
          p.type === 'instance',
      )
    ) {
      protectedIds.add(item.id)
    }
  }

  return {
    db,
    dispatchId,
    readBoundaryRoots: effectiveReadRoots,
    writeBoundaryRoots: effectiveWriteRoots,
    protectedChunkIds: protectedIds,
    invocableId,
  }
}

/** Check if a scope is readable within the dispatch context. */
export const checkReadAccess = (
  ctx: DispatchContext,
  scopeId: string,
): boolean => {
  // Dispatch scope is always accessible
  if (scopeId === ctx.dispatchId) return true
  return isReachable(ctx.db, scopeId, ctx.readBoundaryRoots)
}

/** Check if a scope is writable within the dispatch context. */
export const checkWriteAccess = (
  ctx: DispatchContext,
  scopeId: string,
): boolean => {
  // Dispatch scope is always accessible
  if (scopeId === ctx.dispatchId) return true
  return isReachable(ctx.db, scopeId, ctx.writeBoundaryRoots)
}

/** Check if a chunk is protected (dispatch chunk or boundary containers). */
export const isProtected = (
  ctx: DispatchContext,
  chunkId: string,
): boolean => {
  return ctx.protectedChunkIds.has(chunkId)
}
