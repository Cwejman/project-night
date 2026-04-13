import { describe, test, expect } from 'bun:test'
import { open, apply, scope, COMMITS_SCOPE } from '../src/index.ts'

describe('dispatch_id on commits', () => {
  test('apply with dispatch option records dispatch_id', () => {
    const db = open()
    const result = apply(db, { chunks: [{ body: { text: 'dispatched' } }] }, { dispatch: 'test-dispatch' })

    const row = db
      .query<{ dispatch_id: string | null }, [string]>(
        'SELECT dispatch_id FROM commits WHERE id = ?',
      )
      .get(result.commit.id)

    expect(row).toBeDefined()
    expect(row!.dispatch_id).toBe('test-dispatch')
  })

  test('apply without dispatch has NULL dispatch_id', () => {
    const db = open()
    const result = apply(db, { chunks: [{ body: { text: 'no dispatch' } }] })

    const row = db
      .query<{ dispatch_id: string | null }, [string]>(
        'SELECT dispatch_id FROM commits WHERE id = ?',
      )
      .get(result.commit.id)

    expect(row).toBeDefined()
    expect(row!.dispatch_id).toBeNull()
  })
})

describe('commit projection via scope', () => {
  test('scope([COMMITS_SCOPE]) returns all commits as ChunkItems', () => {
    const db = open()
    apply(db, { chunks: [{ body: { text: 'first' } }] })
    apply(db, { chunks: [{ body: { text: 'second' } }] })
    apply(db, { chunks: [{ body: { text: 'third' } }] })

    const result = scope(db, [COMMITS_SCOPE])

    // root + 3 applies = 4 commits
    expect(result.chunks.items.length).toBe(4)

    // Each item has the correct body structure
    for (const item of result.chunks.items) {
      expect(item.body).toHaveProperty('parent_id')
      expect(item.body).toHaveProperty('timestamp')
      expect(item.body).toHaveProperty('dispatch_id')
    }

    // Each item has a placement on COMMITS_SCOPE
    for (const item of result.chunks.items) {
      expect(item.placements).toHaveLength(1)
      expect(item.placements[0]!.scope_id).toBe(COMMITS_SCOPE)
      expect(item.placements[0]!.type).toBe('instance')
    }
  })

  test('scope([COMMITS_SCOPE]) returns virtual scope chunk', () => {
    const db = open()
    apply(db, { chunks: [{ body: { text: 'test' } }] })

    const result = scope(db, [COMMITS_SCOPE])

    expect(result.scope).toHaveLength(1)
    expect(result.scope[0]!.id).toBe(COMMITS_SCOPE)
    expect(result.scope[0]!.name).toBe('commits')
    expect(result.scope[0]!.body).toEqual({ text: 'Commit history' })
    expect(result.scope[0]!.placements).toEqual([])
  })

  test('scope([COMMITS_SCOPE, dispatchId]) filters by dispatch', () => {
    const db = open()

    // Create a chunk to serve as dispatch identity
    const dispatch = apply(db, { chunks: [{ name: 'my-dispatch', body: { text: 'a dispatch' } }] })
    const dispatchId = dispatch.chunks[0]!.id

    // Apply with dispatch context
    apply(db, { chunks: [{ body: { text: 'dispatched-1' } }] }, { dispatch: dispatchId })
    apply(db, { chunks: [{ body: { text: 'dispatched-2' } }] }, { dispatch: dispatchId })

    // Apply without dispatch
    apply(db, { chunks: [{ body: { text: 'no dispatch' } }] })

    const result = scope(db, [COMMITS_SCOPE, dispatchId])

    // Only the 2 commits with this dispatch_id
    expect(result.chunks.items.length).toBe(2)
    for (const item of result.chunks.items) {
      expect(item.body.dispatch_id).toBe(dispatchId)
    }
  })

  test('scope([COMMITS_SCOPE, chunkId]) filters by chunk modification', () => {
    const db = open()

    // Create two chunks
    const r1 = apply(db, { chunks: [{ name: 'target', body: { text: 'original' } }] })
    const targetId = r1.chunks[0]!.id

    apply(db, { chunks: [{ name: 'other', body: { text: 'unrelated' } }] })

    // Modify target
    apply(db, { chunks: [{ id: targetId, body: { text: 'updated' } }] })

    const result = scope(db, [COMMITS_SCOPE, targetId])

    // Should include commits that created and updated the target chunk
    expect(result.chunks.items.length).toBe(2)

    // All returned commits should be ones that touched targetId
    const commitIds = result.chunks.items.map((item) => item.id)
    for (const cid of commitIds) {
      const row = db
        .query<{ cnt: number }, [string, string]>(
          'SELECT COUNT(*) as cnt FROM chunk_versions WHERE commit_id = ? AND chunk_id = ?',
        )
        .get(cid, targetId)
      expect(row!.cnt).toBeGreaterThan(0)
    }
  })

  test('commit projection connected scopes show dispatch ids', () => {
    const db = open()

    const dispatch = apply(db, { chunks: [{ name: 'dispatch-a', body: { text: 'dispatch' } }] })
    const dispatchId = dispatch.chunks[0]!.id

    apply(db, { chunks: [{ body: { text: 'work' } }] }, { dispatch: dispatchId })
    apply(db, { chunks: [{ body: { text: 'more work' } }] }, { dispatch: dispatchId })

    const result = scope(db, [COMMITS_SCOPE])

    const conn = result.connected.find((c) => c.id === dispatchId)
    expect(conn).toBeDefined()
    expect(conn!.shared).toBe(2)
    expect(conn!.name).toBe('dispatch-a')
  })
})
