import { apply, scope } from '../../ol/src/index.ts'
import { generateId } from '../../ol/src/id.ts'
import type { Db, ChunkDeclaration } from '../../ol/src/types.ts'
import type { DispatchArgs, DispatchResult } from './types.ts'

/**
 * Look up an invocable chunk by ID. Verifies it exists and is an instance
 * of the `invocable` archetype.
 */
const resolveInvocable = (db: Db, invocableId: string): void => {
  const result = scope(db, [invocableId])
  if (result.scope.length === 0) {
    throw new Error(`Invocable not found: ${invocableId}`)
  }
  const chunk = result.scope[0]!
  const isInvocable = chunk.placements.some(
    (p) => p.scope_id === 'invocable' && p.type === 'instance',
  )
  if (!isInvocable) {
    throw new Error(`Chunk ${invocableId} is not an invocable`)
  }
}

/**
 * Build the Declaration for a dispatch. Creates:
 * 1. The dispatch chunk (instance of invocable + dispatch archetype)
 * 2. Read-boundary container with scope references
 * 3. Write-boundary container with scope references
 * 4. Argument chunks with added dispatch placement
 */
const buildDispatchDeclaration = (
  invocableId: string,
  args: DispatchArgs,
): { dispatchId: string; declaration: { chunks: ChunkDeclaration[] } } => {
  const dispatchId = generateId()
  const rbId = generateId()
  const wbId = generateId()

  const chunks: ChunkDeclaration[] = [
    // 1. The dispatch chunk
    {
      id: dispatchId,
      body: { status: 'pending' },
      placements: [
        { scope_id: invocableId, type: 'instance' },
        { scope_id: 'dispatch', type: 'instance' },
      ],
    },

    // 2. Read-boundary container
    {
      id: rbId,
      placements: [
        { scope_id: 'read-boundary', type: 'instance' },
        { scope_id: dispatchId, type: 'instance' },
      ],
    },
    // Place each read boundary scope reference on the container.
    // Uses 'relates' — these are references, not typed content items.
    ...args.readBoundary.map((scopeRef) => ({
      id: scopeRef,
      placements: [{ scope_id: rbId, type: 'relates' as const }],
    })),

    // 3. Write-boundary container
    {
      id: wbId,
      placements: [
        { scope_id: 'write-boundary', type: 'instance' },
        { scope_id: dispatchId, type: 'instance' },
      ],
    },
    // Place each write boundary scope reference on the container.
    // Uses 'relates' — these are references, not typed content items.
    ...args.writeBoundary.map((scopeRef) => ({
      id: scopeRef,
      placements: [{ scope_id: wbId, type: 'relates' as const }],
    })),

    // 4. Argument chunks — add dispatch placement to each
    ...args.chunks.map((chunk) => ({
      ...chunk,
      placements: [
        ...(chunk.placements ?? []),
        { scope_id: dispatchId, type: 'instance' as const },
      ],
    })),
  ]

  return { dispatchId, declaration: { chunks } }
}

/**
 * Create a dispatch. Validates the invocable exists, builds the declaration,
 * and executes a single atomic apply().
 */
export const createDispatch = (
  db: Db,
  invocableId: string,
  args: DispatchArgs,
): DispatchResult => {
  resolveInvocable(db, invocableId)

  const { dispatchId, declaration } = buildDispatchDeclaration(invocableId, args)

  apply(db, declaration, { dispatch: dispatchId })

  return { dispatchId }
}
