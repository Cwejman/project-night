import { describe, test, expect } from 'bun:test'
import { open, apply, SpecViolation } from '../src/index.ts'

describe('spec enforcement', () => {
  test('ordered: rejects placement without seq', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'session', spec: { ordered: true }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    expect(() =>
      apply(db, {
        chunks: [
          {
            body: { text: 'a prompt' },
            placements: [{ scope_id: scopeId, type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('ordered: accepts placement with seq', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'session', spec: { ordered: true }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    const result = apply(db, {
      chunks: [
        {
          body: { text: 'a prompt' },
          placements: [{ scope_id: scopeId, type: 'instance', seq: 1 }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('accepts: rejects chunk that is not an instance of accepted type', () => {
    const db = open()

    const archetype = apply(db, {
      chunks: [{ name: 'session', spec: { accepts: ['prompt'] }, body: {} }],
    })
    const sessionId = archetype.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          name: 'prompt',
          body: { text: 'A prompt type' },
          placements: [{ scope_id: sessionId, type: 'instance' }],
        },
      ],
    })

    expect(() =>
      apply(db, {
        chunks: [
          {
            body: { text: 'not a prompt' },
            placements: [{ scope_id: sessionId, type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('accepts: allows chunk that is an instance of accepted type', () => {
    const db = open()

    const archetype = apply(db, {
      chunks: [{ name: 'session', spec: { accepts: ['prompt'] }, body: {} }],
    })
    const sessionId = archetype.chunks[0]!.id

    const promptType = apply(db, {
      chunks: [
        {
          name: 'prompt',
          body: { text: 'A prompt type' },
          placements: [{ scope_id: sessionId, type: 'instance' }],
        },
      ],
    })
    const promptTypeId = promptType.chunks[0]!.id

    const promptInstance = apply(db, {
      chunks: [
        {
          body: { text: 'Why is scope returning duplicates?' },
          placements: [{ scope_id: promptTypeId, type: 'instance' }],
        },
      ],
    })
    const promptId = promptInstance.chunks[0]!.id

    const result = apply(db, {
      chunks: [
        {
          id: promptId,
          placements: [{ scope_id: sessionId, type: 'instance' }],
        },
      ],
    })

    expect(result.commit.id).toBeTruthy()
  })

  test('required: rejects chunk missing required body keys', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'tool-call', spec: { required: ['tool', 'exit'] }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    expect(() =>
      apply(db, {
        chunks: [
          {
            body: { tool: 'grep' },
            placements: [{ scope_id: scopeId, type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('required: accepts chunk with all required keys', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'tool-call', spec: { required: ['tool', 'exit'] }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    const result = apply(db, {
      chunks: [
        {
          body: { tool: 'grep', exit: 0 },
          placements: [{ scope_id: scopeId, type: 'instance' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('unique: rejects duplicate value for unique key', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'registry', spec: { unique: ['name'] }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          body: { name: 'alice' },
          placements: [{ scope_id: scopeId, type: 'instance' }],
        },
      ],
    })

    expect(() =>
      apply(db, {
        chunks: [
          {
            body: { name: 'alice' },
            placements: [{ scope_id: scopeId, type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('unique: allows different values for unique key', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'registry', spec: { unique: ['name'] }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    apply(db, {
      chunks: [
        {
          body: { name: 'alice' },
          placements: [{ scope_id: scopeId, type: 'instance' }],
        },
      ],
    })

    const result = apply(db, {
      chunks: [
        {
          body: { name: 'bob' },
          placements: [{ scope_id: scopeId, type: 'instance' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('spec enforcement only applies to instance placements', () => {
    const db = open()
    const s = apply(db, {
      chunks: [
        {
          name: 'strict',
          spec: { required: ['mandatory'], ordered: true },
          body: {},
        },
      ],
    })
    const scopeId = s.chunks[0]!.id

    const result = apply(db, {
      chunks: [
        {
          body: { text: 'just a note about this scope' },
          placements: [{ scope_id: scopeId, type: 'relates' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('rollback on spec violation leaves no partial state', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'ordered', spec: { ordered: true }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    expect(() =>
      apply(db, {
        chunks: [
          { name: 'valid', body: { text: 'this is fine' } },
          {
            body: { text: 'this will fail' },
            placements: [{ scope_id: scopeId, type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })
})
