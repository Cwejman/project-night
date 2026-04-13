import { open, apply, scope } from '../../ol/src/index.ts'
import type { Engine } from './types.ts'

/**
 * Initialize the engine. Opens the database, reconciles stuck dispatches
 * from a previous session (marks pending/running as failed).
 */
export const bootstrap = (dbPath: string): Engine => {
  const db = open(dbPath)
  const engine: Engine = { db, processes: new Map() }

  // Reconcile stale dispatches: find all dispatch instances with
  // status 'pending' or 'running' and mark them failed.
  const dispatchScope = scope(db, ['dispatch'])
  for (const item of dispatchScope.chunks.items) {
    const body = item.body as Record<string, unknown>
    if (body.status === 'pending' || body.status === 'running') {
      apply(db, {
        chunks: [{ id: item.id, body: { status: 'failed', error: 'engine restart' } }],
      })
    }
  }

  return engine
}
