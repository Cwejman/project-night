import { describe, test, expect } from 'bun:test'
import { open, apply, search } from '../src/index.ts'

describe('full-text search', () => {
  test('finds chunks by body text', () => {
    const db = open()
    apply(db, {
      chunks: [
        { body: { text: 'The quick brown fox jumps over the lazy dog' } },
        { body: { text: 'A slow red cat sleeps on the mat' } },
      ],
    })

    const results = search(db, 'fox')
    expect(results).toHaveLength(1)
    expect(results[0]!.body).toEqual({
      text: 'The quick brown fox jumps over the lazy dog',
    })
  })

  test('finds chunks by name', () => {
    const db = open()
    apply(db, {
      chunks: [
        { name: 'turing', body: { text: 'A mathematician' } },
        { name: 'einstein', body: { text: 'A physicist' } },
      ],
    })

    const results = search(db, 'turing')
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('turing')
  })

  test('finds chunks by nested body string values', () => {
    const db = open()
    apply(db, {
      chunks: [
        {
          body: {
            text: 'A tool call',
            details: { tool: 'grep', pattern: 'fibonacci' },
          },
        },
      ],
    })

    const results = search(db, 'fibonacci')
    expect(results).toHaveLength(1)
  })

  test('updated chunks are found by new content', () => {
    const db = open()
    const created = apply(db, {
      chunks: [{ name: 'note', body: { text: 'alpha' } }],
    })
    const id = created.chunks[0]!.id

    apply(db, {
      chunks: [{ id, body: { text: 'beta' } }],
    })

    expect(search(db, 'alpha')).toHaveLength(0)
    expect(search(db, 'beta')).toHaveLength(1)
  })

  test('removed chunks are not found', () => {
    const db = open()
    const created = apply(db, {
      chunks: [{ body: { text: 'ephemeral content' } }],
    })

    apply(db, {
      chunks: [{ id: created.chunks[0]!.id, removed: true }],
    })

    expect(search(db, 'ephemeral')).toHaveLength(0)
  })
})
