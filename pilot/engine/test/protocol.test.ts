import { describe, test, expect } from 'bun:test'
import { apply, scope, COMMITS_SCOPE } from '../../ol/src/index.ts'
import { seedTestDb } from './helpers.ts'
import { createDispatch } from '../src/dispatch.ts'
import { buildDispatchContext } from '../src/boundary.ts'
import { parseRequest, handleOp, formatResponse } from '../src/protocol.ts'

describe('protocol', () => {
  describe('parseRequest', () => {
    test('parses valid scope request', () => {
      const result = parseRequest('{"id":1,"op":"scope","scopes":["abc"]}')
      expect(result).toEqual({ id: 1, op: 'scope', scopes: ['abc'] })
    })

    test('parses valid search request', () => {
      const result = parseRequest('{"id":2,"op":"search","query":"hello"}')
      expect(result).toEqual({ id: 2, op: 'search', query: 'hello' })
    })

    test('parses valid apply request', () => {
      const result = parseRequest('{"id":3,"op":"apply","declaration":{"chunks":[{"body":{"text":"hi"}}]}}')
      expect(result).toHaveProperty('op', 'apply')
    })

    test('parses valid dispatch request', () => {
      const result = parseRequest(
        '{"id":4,"op":"dispatch","invocable":"filesystem","args":{"chunks":[],"readBoundary":[],"writeBoundary":[]}}',
      )
      expect(result).toHaveProperty('op', 'dispatch')
    })

    test('parses valid await request', () => {
      const result = parseRequest('{"id":5,"op":"await","dispatches":["d1","d2"]}')
      expect(result).toEqual({ id: 5, op: 'await', dispatches: ['d1', 'd2'] })
    })

    test('returns error for malformed JSON', () => {
      const result = parseRequest('not json')
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('INVALID_REQUEST')
    })

    test('returns error for missing op', () => {
      const result = parseRequest('{"id":1}')
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('INVALID_REQUEST')
    })

    test('returns error for unknown op', () => {
      const result = parseRequest('{"id":1,"op":"unknown"}')
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('INVALID_REQUEST')
    })

    test('returns error for missing id', () => {
      const result = parseRequest('{"op":"scope","scopes":["abc"]}')
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('INVALID_REQUEST')
    })
  })

  describe('handleOp', () => {
    test('scope within boundary returns ScopeResult', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, { id: 1, op: 'scope', scopes: ['agent'] })
      expect(result).toHaveProperty('id', 1)
      expect(result).toHaveProperty('result')
      expect((result as { result: { chunks: unknown } }).result).toHaveProperty('chunks')
    })

    test('scope outside boundary returns BOUNDARY_VIOLATION', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, { id: 2, op: 'scope', scopes: ['engine'] })
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('BOUNDARY_VIOLATION')
    })

    test('scope on dispatch scope always works', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'filesystem', {
        chunks: [],
        readBoundary: [],
        writeBoundary: [],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'filesystem')

      const result = handleOp(ctx, { id: 1, op: 'scope', scopes: [dispatchId] })
      expect(result).toHaveProperty('result')
    })

    test('search returns results', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, { id: 3, op: 'search', query: 'filesystem' })
      expect(result).toHaveProperty('id', 3)
      expect(result).toHaveProperty('result')
    })

    test('apply within write boundary succeeds', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, {
        id: 4,
        op: 'apply',
        declaration: {
          chunks: [
            {
              body: { text: 'result from invocable' },
              placements: [{ scope_id: dispatchId, type: 'relates' }],
            },
          ],
        },
      })
      expect(result).toHaveProperty('result')
      expect((result as { result: { commit: unknown } }).result).toHaveProperty('commit')
    })

    test('apply outside write boundary returns BOUNDARY_VIOLATION', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent', 'engine'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, {
        id: 5,
        op: 'apply',
        declaration: {
          chunks: [
            {
              body: { text: 'trying to write to engine' },
              placements: [{ scope_id: 'engine', type: 'instance' }],
            },
          ],
        },
      })
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('BOUNDARY_VIOLATION')
    })

    test('apply to protected chunk returns BOUNDARY_VIOLATION', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, {
        id: 6,
        op: 'apply',
        declaration: {
          chunks: [{ id: dispatchId, body: { status: 'completed' } }],
        },
      })
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('BOUNDARY_VIOLATION')
    })

    test('apply sets dispatch_id on commit', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      handleOp(ctx, {
        id: 7,
        op: 'apply',
        declaration: {
          chunks: [
            {
              body: { text: 'tracked write' },
              placements: [{ scope_id: dispatchId, type: 'relates' }],
            },
          ],
        },
      })

      const commits = scope(db, [COMMITS_SCOPE, dispatchId])
      // Should have at least 2 commits: dispatch creation + invocable write
      expect(commits.chunks.items.length).toBeGreaterThanOrEqual(2)
    })

    test('apply with spec violation returns VALIDATION_ERROR', () => {
      const db = seedTestDb()
      // Create a session instance first
      apply(db, {
        chunks: [
          {
            id: 'test-session',
            name: 'test-session',
            body: { text: 'test session' },
            placements: [{ scope_id: 'session', type: 'instance' }],
          },
        ],
      })

      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      // Session has accepts: ['prompt', 'answer', 'tool-call', 'tool-result', 'context']
      // Placing a chunk directly without being an instance of one of those should fail
      const result = handleOp(ctx, {
        id: 8,
        op: 'apply',
        declaration: {
          chunks: [
            {
              body: { text: 'not a valid session event type' },
              placements: [{ scope_id: 'test-session', type: 'instance' }],
            },
          ],
        },
      })
      expect(result).toHaveProperty('error')
      expect((result as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
    })

    test('dispatch creates child dispatch', () => {
      const db = seedTestDb()
      const { dispatchId } = createDispatch(db, 'claude', {
        chunks: [],
        readBoundary: ['agent'],
        writeBoundary: ['agent'],
      })
      const ctx = buildDispatchContext(db, dispatchId, 'claude')

      const result = handleOp(ctx, {
        id: 9,
        op: 'dispatch',
        invocable: 'filesystem',
        args: {
          chunks: [
            {
              body: { operation: 'read', path: '/src/main.ts' },
              placements: [{ scope_id: 'fs-command', type: 'instance' }],
            },
          ],
          readBoundary: ['agent'],
          writeBoundary: ['agent'],
        },
      })
      expect(result).toHaveProperty('result')
      const childId = (result as { result: { dispatch: string } }).result.dispatch
      expect(childId).toBeTruthy()

      // Verify the child dispatch exists
      const childScope = scope(db, [childId])
      expect(childScope.scope).toHaveLength(1)
    })
  })

  describe('formatResponse', () => {
    test('serializes result as JSON line', () => {
      const line = formatResponse({ id: 1, result: { some: 'data' } })
      expect(line).toBe('{"id":1,"result":{"some":"data"}}\n')
    })

    test('serializes error as JSON line', () => {
      const line = formatResponse({
        id: 2,
        error: { code: 'BOUNDARY_VIOLATION', message: 'access denied' },
      })
      expect(line).toBe(
        '{"id":2,"error":{"code":"BOUNDARY_VIOLATION","message":"access denied"}}\n',
      )
    })
  })
})
