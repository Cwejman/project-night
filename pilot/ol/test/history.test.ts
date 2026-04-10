import { describe, test, expect } from 'bun:test'
import { open, apply, log } from '../src/index.ts'

describe('history', () => {
  test('log returns commits in reverse order from HEAD', () => {
    const db = open()
    const r1 = apply(db, { chunks: [{ body: { text: 'first' } }] })
    const r2 = apply(db, { chunks: [{ body: { text: 'second' } }] })
    const r3 = apply(db, { chunks: [{ body: { text: 'third' } }] })

    const commits = log(db)

    expect(commits[0]!.id).toBe(r3.commit.id)
    expect(commits[1]!.id).toBe(r2.commit.id)
    expect(commits[2]!.id).toBe(r1.commit.id)
    expect(commits[commits.length - 1]!.parent_id).toBeNull()
  })

  test('commits form a parent chain', () => {
    const db = open()
    const r1 = apply(db, { chunks: [{ body: { text: 'one' } }] })
    const r2 = apply(db, { chunks: [{ body: { text: 'two' } }] })

    expect(r2.commit.parent_id).toBe(r1.commit.id)
  })

  test('log respects limit', () => {
    const db = open()
    for (let i = 0; i < 10; i++) {
      apply(db, { chunks: [{ body: { n: i } }] })
    }

    const commits = log(db, 3)
    expect(commits).toHaveLength(3)
  })

  test('each commit has a timestamp', () => {
    const db = open()
    const result = apply(db, { chunks: [{ body: { text: 'timed' } }] })

    expect(result.commit.timestamp).toBeTruthy()
    expect(new Date(result.commit.timestamp).toISOString()).toBe(result.commit.timestamp)
  })
})
