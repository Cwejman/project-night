import { describe, test, expect } from 'bun:test'
import { scope } from '../../ol/src/index.ts'
import { seedTestDb } from './helpers.ts'
import { createDispatch } from '../src/dispatch.ts'
import {
  isReachable,
  checkReadAccess,
  checkWriteAccess,
  isProtected,
  buildDispatchContext,
} from '../src/boundary.ts'

describe('boundary enforcement', () => {
  describe('isReachable', () => {
    test('direct boundary root is reachable', () => {
      const db = seedTestDb()
      expect(isReachable(db, 'agent', ['agent'])).toBe(true)
    })

    test('instance-chain reachable scope is accessible', () => {
      const db = seedTestDb()
      // session is instance on agent
      expect(isReachable(db, 'session', ['agent'])).toBe(true)
    })

    test('deeper instance chain is reachable', () => {
      const db = seedTestDb()
      // prompt is instance on agent (directly)
      expect(isReachable(db, 'prompt', ['agent'])).toBe(true)
    })

    test('unreachable scope is rejected', () => {
      const db = seedTestDb()
      // engine is not reachable from agent via instance chains
      expect(isReachable(db, 'engine', ['agent'])).toBe(false)
    })

    test('empty boundary roots means nothing is reachable', () => {
      const db = seedTestDb()
      expect(isReachable(db, 'agent', [])).toBe(false)
    })
  })

  describe('dispatch context and access checks', () => {
    test('dispatch scope always accessible for reads', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: [],
        writeBoundary: [],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')
      expect(checkReadAccess(ctx, dispatchId)).toBe(true)
    })

    test('dispatch scope always accessible for writes', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: [],
        writeBoundary: [],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')
      expect(checkWriteAccess(ctx, dispatchId)).toBe(true)
    })

    test('read boundary root is accessible', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')
      expect(checkReadAccess(ctx, 'agent')).toBe(true)
    })

    test('instance-chain reachable scope is readable', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')
      // session is instance on agent
      expect(checkReadAccess(ctx, 'session')).toBe(true)
    })

    test('scope outside read boundary is rejected', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')
      expect(checkReadAccess(ctx, 'engine')).toBe(false)
    })

    test('scope outside write boundary is rejected', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent', 'engine'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')
      // engine is readable but not writable
      expect(checkReadAccess(ctx, 'engine')).toBe(true)
      expect(checkWriteAccess(ctx, 'engine')).toBe(false)
    })

    test('filesystem intrinsic boundary limits to dispatch scope only', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')
      // filesystem has boundary:'dispatch' — intrinsic is dispatch scope only
      // Even though dispatch-level boundary includes 'agent', effective is just dispatch
      expect(checkWriteAccess(ctx, dispatchId)).toBe(true)
      expect(checkWriteAccess(ctx, 'agent')).toBe(false)
    })

    test('open boundary uses dispatch-level boundary as effective', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')
      // claude has boundary:'open' — effective = dispatch-level
      expect(checkReadAccess(ctx, 'agent')).toBe(true)
      expect(checkWriteAccess(ctx, 'agent')).toBe(true)
    })
  })

  describe('protected chunks', () => {
    test('dispatch chunk is protected', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')
      expect(isProtected(ctx, dispatchId)).toBe(true)
    })

    test('boundary containers are protected', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')

      // Find the boundary container chunk IDs
      const result = scope(db, [dispatchId])
      const rbContainer = result.chunks.items.find((c) =>
        c.placements.some((p) => p.scope_id === 'read-boundary' && p.type === 'instance'),
      )
      const wbContainer = result.chunks.items.find((c) =>
        c.placements.some((p) => p.scope_id === 'write-boundary' && p.type === 'instance'),
      )
      expect(rbContainer).toBeDefined()
      expect(wbContainer).toBeDefined()
      expect(isProtected(ctx, rbContainer!.id)).toBe(true)
      expect(isProtected(ctx, wbContainer!.id)).toBe(true)
    })

    test('regular chunks are not protected', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')
      expect(isProtected(ctx, 'agent')).toBe(false)
    })
  })
})
