import { describe, test, expect } from 'bun:test'
import { scope, log, COMMITS_SCOPE } from '../../ol/src/index.ts'
import { seedTestDb } from './helpers.ts'
import { createDispatch } from '../src/dispatch.ts'

describe('dispatch creation', () => {
  test('creates dispatch chunk as instance of invocable and dispatch archetype', () => {
    const db = seedTestDb()
    const { dispatchId } = createDispatch(db, 'filesystem', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })

    const result = scope(db, [dispatchId])
    // The dispatch chunk itself should exist
    expect(result.scope).toHaveLength(1)
    const dispatch = result.scope[0]!
    expect(dispatch.id).toBe(dispatchId)
    expect((dispatch.body as Record<string, unknown>).status).toBe('pending')

    // Should be instance of both filesystem and dispatch
    const instancePlacements = dispatch.placements.filter((p) => p.type === 'instance')
    const scopeIds = instancePlacements.map((p) => p.scope_id)
    expect(scopeIds).toContain('filesystem')
    expect(scopeIds).toContain('dispatch')
  })

  test('creates read-boundary container with scope references', () => {
    const db = seedTestDb()
    const { dispatchId } = createDispatch(db, 'filesystem', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })

    const result = scope(db, [dispatchId])
    // Find the read-boundary container among children
    const rbContainer = result.chunks.items.find((c) =>
      c.placements.some((p) => p.scope_id === 'read-boundary' && p.type === 'instance'),
    )
    expect(rbContainer).toBeDefined()

    // The boundary scope reference ('agent') should be placed as relates on the container
    const rbScope = scope(db, [rbContainer!.id])
    const agentRef = rbScope.chunks.items.find((c) => c.id === 'agent')
    expect(agentRef).toBeDefined()
    expect(agentRef!.placements.some((p) => p.scope_id === rbContainer!.id && p.type === 'relates')).toBe(true)
  })

  test('creates write-boundary container with scope references', () => {
    const db = seedTestDb()
    const { dispatchId } = createDispatch(db, 'filesystem', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })

    const result = scope(db, [dispatchId])
    const wbContainer = result.chunks.items.find((c) =>
      c.placements.some((p) => p.scope_id === 'write-boundary' && p.type === 'instance'),
    )
    expect(wbContainer).toBeDefined()

    const wbScope = scope(db, [wbContainer!.id])
    const agentRef = wbScope.chunks.items.find((c) => c.id === 'agent')
    expect(agentRef).toBeDefined()
    expect(agentRef!.placements.some((p) => p.scope_id === wbContainer!.id && p.type === 'relates')).toBe(true)
  })

  test('places argument chunks on the dispatch', () => {
    const db = seedTestDb()
    const { dispatchId } = createDispatch(db, 'filesystem', {
      chunks: [
        {
          body: { operation: 'read', path: '/src/main.ts' },
          placements: [{ scope_id: 'fs-command', type: 'instance' as const }],
        },
      ],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })

    const result = scope(db, [dispatchId])
    // Find the argument chunk (instance of fs-command)
    const argChunk = result.chunks.items.find((c) =>
      c.placements.some((p) => p.scope_id === 'fs-command' && p.type === 'instance'),
    )
    expect(argChunk).toBeDefined()
    expect((argChunk!.body as Record<string, unknown>).operation).toBe('read')
    // Should also be placed on the dispatch
    expect(argChunk!.placements.some((p) => p.scope_id === dispatchId && p.type === 'instance')).toBe(true)
  })

  test('creates everything in a single atomic apply', () => {
    const db = seedTestDb()
    const commitsBefore = log(db)

    createDispatch(db, 'filesystem', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })

    const commitsAfter = log(db)
    expect(commitsAfter.length).toBe(commitsBefore.length + 1)
  })

  test('records dispatch_id on the commit', () => {
    const db = seedTestDb()
    const { dispatchId } = createDispatch(db, 'filesystem', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })

    const commits = scope(db, [COMMITS_SCOPE, dispatchId])
    expect(commits.chunks.items.length).toBeGreaterThanOrEqual(1)
  })

  test('rejects unknown invocable', () => {
    const db = seedTestDb()
    expect(() =>
      createDispatch(db, 'nonexistent', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      }),
    ).toThrow('not found')
  })

  test('rejects non-invocable chunk', () => {
    const db = seedTestDb()
    expect(() =>
      createDispatch(db, 'agent', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      }),
    ).toThrow('not an invocable')
  })

  test('multiple dispatches produce unique IDs', () => {
    const db = seedTestDb()
    const args = { chunks: [], readBoundary: ['agent'], writeBoundary: ['agent'] } as const
    const r1 = createDispatch(db, 'filesystem', args)
    const r2 = createDispatch(db, 'filesystem', args)
    expect(r1.dispatchId).not.toBe(r2.dispatchId)
  })

  test('creates multiple boundary scope references', () => {
    const db = seedTestDb()
    const { dispatchId } = createDispatch(db, 'claude', {
      chunks: [],
      readBoundary: ['agent', 'engine'],
      writeBoundary: ['agent'],
    })

    const result = scope(db, [dispatchId])
    const rbContainer = result.chunks.items.find((c) =>
      c.placements.some((p) => p.scope_id === 'read-boundary' && p.type === 'instance'),
    )
    expect(rbContainer).toBeDefined()

    const rbScope = scope(db, [rbContainer!.id])
    const refs = rbScope.chunks.items.map((c) => c.id)
    expect(refs).toContain('agent')
    expect(refs).toContain('engine')
  })
})
