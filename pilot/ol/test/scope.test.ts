import { describe, test, expect } from 'bun:test'
import { open, apply, scope } from '../src/index.ts'

describe('scope queries', () => {
  test('scope returns chunks placed on a scope', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'project', body: { text: 'My project' } }],
    })
    const projectId = parent.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          name: 'note-1',
          body: { text: 'First note' },
          placements: [{ scope_id: projectId, type: 'instance' }],
        },
        {
          name: 'note-2',
          body: { text: 'Second note' },
          placements: [{ scope_id: projectId, type: 'instance' }],
        },
      ],
    })

    const result = scope(db, [projectId])
    expect(result.chunks.items).toHaveLength(2)
    expect(result.chunks.items.map((c) => c.name).sort()).toEqual(['note-1', 'note-2'])
  })

  test('scope intersection returns only chunks in ALL scopes', () => {
    const db = open()
    const scopes = apply(db, {
      chunks: [
        { name: 'ai', body: { text: 'AI topic' } },
        { name: 'ethics', body: { text: 'Ethics topic' } },
      ],
    })
    const aiId = scopes.chunks[0]!.id
    const ethicsId = scopes.chunks[1]!.id

    apply(db, {
      chunks: [
        {
          name: 'ai-ethics',
          body: { text: 'AI Ethics paper' },
          placements: [
            { scope_id: aiId, type: 'relates' },
            { scope_id: ethicsId, type: 'relates' },
          ],
        },
      ],
    })

    apply(db, {
      chunks: [
        {
          name: 'ml-basics',
          body: { text: 'ML fundamentals' },
          placements: [{ scope_id: aiId, type: 'relates' }],
        },
      ],
    })

    const intersection = scope(db, [aiId, ethicsId])
    expect(intersection.chunks.items).toHaveLength(1)
    expect(intersection.chunks.items[0]!.name).toBe('ai-ethics')
  })

  test('scope with empty ids returns total count', () => {
    const db = open()
    apply(db, {
      chunks: [
        { name: 'a', body: {} },
        { name: 'b', body: {} },
      ],
    })

    const result = scope(db, [])
    expect(result.chunks.total).toBe(2)
    expect(result.scope).toEqual([])
  })

  test('scope returns both instance and relates placements', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'topic', body: {} }],
    })
    const topicId = parent.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          name: 'member',
          body: { text: 'I am a member' },
          placements: [{ scope_id: topicId, type: 'instance' }],
        },
        {
          name: 'about',
          body: { text: 'I am about this topic' },
          placements: [{ scope_id: topicId, type: 'relates' }],
        },
      ],
    })

    const result = scope(db, [topicId])
    expect(result.chunks.items).toHaveLength(2)
    expect(result.chunks.instance).toBe(1)
    expect(result.chunks.relates).toBe(1)
  })

  test('removed chunks do not appear in scope', () => {
    const db = open()
    const parent = apply(db, {
      chunks: [{ name: 'container', body: {} }],
    })
    const containerId = parent.chunks[0]!.id

    const child = apply(db, {
      chunks: [
        {
          name: 'temporary',
          body: { text: 'will be removed' },
          placements: [{ scope_id: containerId, type: 'instance' }],
        },
      ],
    })

    apply(db, {
      chunks: [{ id: child.chunks[0]!.id, removed: true }],
    })

    const result = scope(db, [containerId])
    expect(result.chunks.items).toHaveLength(0)
  })

  test('scope items include their placements', () => {
    const db = open()
    const scopes = apply(db, {
      chunks: [
        { name: 'a', body: {} },
        { name: 'b', body: {} },
      ],
    })
    const aId = scopes.chunks[0]!.id
    const bId = scopes.chunks[1]!.id

    apply(db, {
      chunks: [
        {
          name: 'bridge',
          body: { text: 'connects a and b' },
          placements: [
            { scope_id: aId, type: 'relates' },
            { scope_id: bId, type: 'relates' },
          ],
        },
      ],
    })

    const result = scope(db, [aId])
    expect(result.chunks.items).toHaveLength(1)
    expect(result.chunks.items[0]!.placements).toHaveLength(2)
  })

  test('connected scopes show where you can navigate', () => {
    const db = open()
    const project = apply(db, {
      chunks: [{ name: 'project', body: {} }],
    })
    const projectId = project.chunks[0]!.id

    const topic = apply(db, {
      chunks: [{ name: 'ai', body: {} }],
    })
    const aiId = topic.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          body: { text: 'ai-related note' },
          placements: [
            { scope_id: projectId, type: 'instance' },
            { scope_id: aiId, type: 'relates' },
          ],
        },
      ],
    })

    const result = scope(db, [projectId])
    expect(result.connected.length).toBeGreaterThan(0)

    const aiConn = result.connected.find((c) => c.id === aiId)
    expect(aiConn).toBeDefined()
    expect(aiConn!.shared).toBe(1)
  })
})
