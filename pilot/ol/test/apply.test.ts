import { describe, test, expect } from 'bun:test'
import { open, apply, scope, SpecViolation } from '../src/index.ts'

describe('apply', () => {
  test('creates a chunk and returns its id', () => {
    const db = open()
    const result = apply(db, {
      chunks: [{ body: { text: 'hello world' } }],
    })

    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0]!.created).toBe(true)
    expect(result.commit.id).toBeTruthy()
  })

  test('created chunk is readable via scope', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const parentId = parent.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          name: 'greeting',
          body: { text: 'hello' },
          placements: [{ scope_id: parentId, type: 'instance' }],
        },
      ],
    })

    const result = scope(db, [parentId])
    const item = result.chunks.items.find((c) => c.name === 'greeting')
    expect(item).toBeDefined()
    expect(item!.body).toEqual({ text: 'hello' })
  })

  test('scope returns the scope chunk itself', () => {
    const db = open()
    const created = apply(db, {
      chunks: [{ name: 'project', body: { text: 'My project' } }],
    })
    const id = created.chunks[0]!.id

    const result = scope(db, [id])
    expect(result.scope).toHaveLength(1)
    expect(result.scope[0]!.id).toBe(id)
    expect(result.scope[0]!.name).toBe('project')
    expect(result.scope[0]!.body).toEqual({ text: 'My project' })
  })

  test('scope includes head commit', () => {
    const db = open()
    const created = apply(db, {
      chunks: [{ body: { text: 'test' } }],
    })
    const id = created.chunks[0]!.id

    const result = scope(db, [id])
    expect(result.head).toBe(created.commit.id)
  })

  test('scope includes total chunk count', () => {
    const db = open()
    apply(db, {
      chunks: [
        { name: 'a', body: {} },
        { name: 'b', body: {} },
        { name: 'c', body: {} },
      ],
    })

    const result = scope(db, [])
    expect(result.chunks.total).toBe(3)
  })

  test('creates a chunk with spec', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const parentId = parent.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          name: 'session',
          spec: { ordered: true },
          body: { text: 'A session type' },
          placements: [{ scope_id: parentId, type: 'instance' }],
        },
      ],
    })

    const result = scope(db, [parentId])
    const item = result.chunks.items.find((c) => c.name === 'session')
    expect(item!.spec).toEqual({ ordered: true })
  })

  test('creates a chunk with placements', () => {
    const db = open()
    const scopeResult = apply(db, {
      chunks: [{ name: 'project', body: { text: 'My project' } }],
    })
    const scopeId = scopeResult.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          name: 'note',
          body: { text: 'A note' },
          placements: [{ scope_id: scopeId, type: 'instance' }],
        },
      ],
    })

    const result = scope(db, [scopeId])
    expect(result.chunks.items).toHaveLength(1)
    expect(result.chunks.items[0]!.placements).toHaveLength(1)
    expect(result.chunks.items[0]!.placements[0]!.scope_id).toBe(scopeId)
  })

  test('updates an existing chunk', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const parentId = parent.chunks[0]!.id

    const created = apply(db, {
      chunks: [
        {
          name: 'note',
          body: { text: 'draft' },
          placements: [{ scope_id: parentId, type: 'instance' }],
        },
      ],
    })
    const id = created.chunks[0]!.id

    apply(db, {
      chunks: [{ id, body: { text: 'final' } }],
    })

    const result = scope(db, [parentId])
    const item = result.chunks.items.find((c) => c.id === id)
    expect(item!.body).toEqual({ text: 'final' })
    expect(item!.name).toBe('note')
  })

  test('soft removes a chunk', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const parentId = parent.chunks[0]!.id

    const created = apply(db, {
      chunks: [
        {
          body: { text: 'temporary' },
          placements: [{ scope_id: parentId, type: 'instance' }],
        },
      ],
    })
    const id = created.chunks[0]!.id

    apply(db, {
      chunks: [{ id, removed: true }],
    })

    const result = scope(db, [parentId])
    expect(result.chunks.items.find((c) => c.id === id)).toBeUndefined()
  })

  test('multiple chunks in one declaration are atomic', () => {
    const db = open()
    const result = apply(db, {
      chunks: [
        { name: 'a', body: { text: 'first' } },
        { name: 'b', body: { text: 'second' } },
      ],
    })

    expect(result.chunks).toHaveLength(2)
    expect(result.chunks[0]!.created).toBe(true)
    expect(result.chunks[1]!.created).toBe(true)
  })

  test('each apply creates a new commit', () => {
    const db = open()
    const r1 = apply(db, { chunks: [{ body: { text: 'one' } }] })
    const r2 = apply(db, { chunks: [{ body: { text: 'two' } }] })

    expect(r1.commit.id).not.toBe(r2.commit.id)
    expect(r2.commit.parent_id).toBe(r1.commit.id)
  })

  test('chunk placed on multiple scopes creates a connection', () => {
    const db = open()
    const scopes = apply(db, {
      chunks: [
        { name: 'turing', body: { text: 'Alan Turing' } },
        { name: 'cambridge', body: { text: 'Cambridge University' } },
      ],
    })

    const turingId = scopes.chunks[0]!.id
    const cambridgeId = scopes.chunks[1]!.id

    const connection = apply(db, {
      chunks: [
        {
          body: { text: 'Turing studied at Cambridge' },
          placements: [
            { scope_id: turingId, type: 'relates' },
            { scope_id: cambridgeId, type: 'relates' },
          ],
        },
      ],
    })

    const connectionId = connection.chunks[0]!.id

    const inTuring = scope(db, [turingId])
    const inCambridge = scope(db, [cambridgeId])

    expect(inTuring.chunks.items.some((c) => c.id === connectionId)).toBe(true)
    expect(inCambridge.chunks.items.some((c) => c.id === connectionId)).toBe(true)

    // Scope intersection returns only the connection
    const intersection = scope(db, [turingId, cambridgeId])
    expect(intersection.chunks.items).toHaveLength(1)
    expect(intersection.chunks.items[0]!.id).toBe(connectionId)
  })

  test('scope returns connected scopes sorted by shared count', () => {
    const db = open()
    const project = apply(db, {
      chunks: [{ name: 'project', body: {} }],
    })
    const projectId = project.chunks[0]!.id

    const types = apply(db, {
      chunks: [
        { name: 'type-a', body: {} },
        { name: 'type-b', body: {} },
      ],
    })
    const typeAId = types.chunks[0]!.id
    const typeBId = types.chunks[1]!.id

    // 3 chunks on type-a, 1 on type-b
    apply(db, {
      chunks: [
        {
          body: { text: '1' },
          placements: [
            { scope_id: projectId, type: 'instance' },
            { scope_id: typeAId, type: 'instance' },
          ],
        },
        {
          body: { text: '2' },
          placements: [
            { scope_id: projectId, type: 'instance' },
            { scope_id: typeAId, type: 'instance' },
          ],
        },
        {
          body: { text: '3' },
          placements: [
            { scope_id: projectId, type: 'instance' },
            { scope_id: typeAId, type: 'instance' },
            { scope_id: typeBId, type: 'instance' },
          ],
        },
      ],
    })

    const result = scope(db, [projectId])
    expect(result.chunks.in_scope).toBe(3)

    // type-a has 3 shared, type-b has 1 — type-a should be first
    const typeAConn = result.connected.find((c) => c.id === typeAId)
    const typeBConn = result.connected.find((c) => c.id === typeBId)
    expect(typeAConn).toBeDefined()
    expect(typeBConn).toBeDefined()
    expect(typeAConn!.shared).toBe(3)
    expect(typeBConn!.shared).toBe(1)

    // sorted: type-a before type-b
    const aIdx = result.connected.findIndex((c) => c.id === typeAId)
    const bIdx = result.connected.findIndex((c) => c.id === typeBId)
    expect(aIdx).toBeLessThan(bIdx)
  })

  test('soft removes a placement', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const parentId = parent.chunks[0]!.id

    const created = apply(db, {
      chunks: [
        {
          name: 'note',
          body: { text: 'placed' },
          placements: [{ scope_id: parentId, type: 'instance' }],
        },
      ],
    })
    const noteId = created.chunks[0]!.id

    // Verify it appears in scope
    const before = scope(db, [parentId])
    expect(before.chunks.items.find((c) => c.id === noteId)).toBeDefined()

    // Remove the placement
    apply(db, {
      chunks: [
        {
          id: noteId,
          placements: [{ scope_id: parentId, type: 'instance', removed: true }],
        },
      ],
    })

    // Should no longer appear in scope
    const after = scope(db, [parentId])
    expect(after.chunks.items.find((c) => c.id === noteId)).toBeUndefined()
  })

  test('removed placement no longer appears in scope queries', () => {
    const db = open()
    const scopeA = apply(db, {
      chunks: [{ name: 'scope-a', body: {} }],
    })
    const scopeB = apply(db, {
      chunks: [{ name: 'scope-b', body: {} }],
    })
    const scopeAId = scopeA.chunks[0]!.id
    const scopeBId = scopeB.chunks[0]!.id

    const created = apply(db, {
      chunks: [
        {
          name: 'shared',
          body: { text: 'in both' },
          placements: [
            { scope_id: scopeAId, type: 'instance' },
            { scope_id: scopeBId, type: 'instance' },
          ],
        },
      ],
    })
    const chunkId = created.chunks[0]!.id

    // Remove from scope-a only
    apply(db, {
      chunks: [
        {
          id: chunkId,
          placements: [{ scope_id: scopeAId, type: 'instance', removed: true }],
        },
      ],
    })

    // Gone from scope-a
    const resultA = scope(db, [scopeAId])
    expect(resultA.chunks.items.find((c) => c.id === chunkId)).toBeUndefined()

    // Still in scope-b
    const resultB = scope(db, [scopeBId])
    expect(resultB.chunks.items.find((c) => c.id === chunkId)).toBeDefined()
  })

  test('removed placement records version with active 0', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const parentId = parent.chunks[0]!.id

    const created = apply(db, {
      chunks: [
        {
          name: 'note',
          body: { text: 'versioned' },
          placements: [{ scope_id: parentId, type: 'instance' }],
        },
      ],
    })
    const noteId = created.chunks[0]!.id

    const removeResult = apply(db, {
      chunks: [
        {
          id: noteId,
          placements: [{ scope_id: parentId, type: 'instance', removed: true }],
        },
      ],
    })

    // Check placement_versions has the deactivation record
    const row = db
      .query<
        { active: number },
        [string, string, string]
      >(
        'SELECT active FROM placement_versions WHERE chunk_id = ? AND scope_id = ? AND commit_id = ?',
      )
      .get(noteId, parentId, removeResult.commit.id)

    expect(row).toBeDefined()
    expect(row!.active).toBe(0)
  })

  test('two-pass: dual placement order does not matter', () => {
    const db = open()

    // Create archetype with accepts
    apply(db, {
      chunks: [
        {
          id: 'archetype',
          name: 'archetype',
          spec: { accepts: ['some-type'] },
          body: {},
        },
        {
          id: 'some-type',
          name: 'some-type',
          body: {},
          placements: [{ scope_id: 'archetype', type: 'relates' }],
        },
      ],
    })

    // Place a chunk with scope_placement BEFORE type_placement in the array.
    // Old code would fail because enforce runs before the type placement is written.
    // Two-pass writes all placements first, then enforces.
    const result = apply(db, {
      chunks: [
        {
          body: { text: 'dual placement chunk' },
          placements: [
            { scope_id: 'archetype', type: 'instance' },
            { scope_id: 'some-type', type: 'instance' },
          ],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('seq auto-assignment on ordered scope', () => {
    const db = open()

    apply(db, {
      chunks: [
        {
          id: 'ordered-scope',
          name: 'ordered-scope',
          spec: { ordered: true },
          body: {},
        },
      ],
    })

    // Place first chunk with no seq — should auto-assign 1
    const r1 = apply(db, {
      chunks: [
        {
          body: { text: 'first' },
          placements: [{ scope_id: 'ordered-scope', type: 'instance' }],
        },
      ],
    })
    expect(r1.chunks[0]!.created).toBe(true)

    // Place second chunk with no seq — should auto-assign 2
    const r2 = apply(db, {
      chunks: [
        {
          body: { text: 'second' },
          placements: [{ scope_id: 'ordered-scope', type: 'instance' }],
        },
      ],
    })
    expect(r2.chunks[0]!.created).toBe(true)

    // Verify seq values via scope query
    const result = scope(db, ['ordered-scope'])
    const items = result.chunks.items
    const first = items.find((c) => c.body.text === 'first')
    const second = items.find((c) => c.body.text === 'second')

    expect(first!.placements[0]!.seq).toBe(1)
    expect(second!.placements[0]!.seq).toBe(2)

    // Explicit seq still works
    const r3 = apply(db, {
      chunks: [
        {
          body: { text: 'explicit' },
          placements: [{ scope_id: 'ordered-scope', type: 'instance', seq: 10 }],
        },
      ],
    })
    expect(r3.chunks[0]!.created).toBe(true)

    const afterExplicit = scope(db, ['ordered-scope'])
    const explicit = afterExplicit.chunks.items.find((c) => c.body.text === 'explicit')
    expect(explicit!.placements[0]!.seq).toBe(10)
  })

  test('name uniqueness: rejects duplicate name on same scope', () => {
    const db = open()

    apply(db, {
      chunks: [{ id: 'container', name: 'container', body: {} }],
    })

    apply(db, {
      chunks: [
        {
          name: 'duplicate-name',
          body: { text: 'first' },
          placements: [{ scope_id: 'container', type: 'instance' }],
        },
      ],
    })

    expect(() =>
      apply(db, {
        chunks: [
          {
            name: 'duplicate-name',
            body: { text: 'second' },
            placements: [{ scope_id: 'container', type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('name uniqueness: allows same name on different scopes', () => {
    const db = open()

    apply(db, {
      chunks: [
        { id: 'scope-a', name: 'scope-a', body: {} },
        { id: 'scope-b', name: 'scope-b', body: {} },
      ],
    })

    apply(db, {
      chunks: [
        {
          name: 'shared-name',
          body: { text: 'in scope a' },
          placements: [{ scope_id: 'scope-a', type: 'instance' }],
        },
      ],
    })

    const result = apply(db, {
      chunks: [
        {
          name: 'shared-name',
          body: { text: 'in scope b' },
          placements: [{ scope_id: 'scope-b', type: 'instance' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })
})
