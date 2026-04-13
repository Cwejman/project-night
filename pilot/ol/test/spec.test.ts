import { describe, test, expect } from 'bun:test'
import { open, apply, SpecViolation } from '../src/index.ts'

describe('spec enforcement', () => {
  test('ordered: auto-assigns seq when omitted', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'session', spec: { ordered: true }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    const result = apply(db, {
      chunks: [
        {
          body: { text: 'a prompt' },
          placements: [{ scope_id: scopeId, type: 'instance' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
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
          placements: [{ scope_id: sessionId, type: 'relates' }],
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
          placements: [{ scope_id: sessionId, type: 'relates' }],
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

  test('propagate: composes accepts from archetype chain', () => {
    const db = open()

    // dispatch archetype: requires read-boundary and write-boundary
    apply(db, {
      chunks: [
        {
          id: 'dispatch',
          name: 'dispatch',
          spec: { propagate: true, accepts: ['read-boundary', 'write-boundary'] },
          body: { text: 'A dispatch event' },
        },
        {
          id: 'read-boundary',
          name: 'read-boundary',
          body: { text: 'Scopes the invocable can read' },
          placements: [{ scope_id: 'dispatch', type: 'relates' }],
        },
        {
          id: 'write-boundary',
          name: 'write-boundary',
          body: { text: 'Scopes the invocable can write to' },
          placements: [{ scope_id: 'dispatch', type: 'relates' }],
        },
      ],
    })

    // claude invocable: requires session, context, prompt
    apply(db, {
      chunks: [
        {
          id: 'claude',
          name: 'claude',
          spec: { propagate: true, ordered: true, accepts: ['session', 'context', 'prompt'] },
          body: { text: 'Claude agent', executable: './invocables/claude' },
        },
        {
          id: 'session',
          name: 'session',
          body: { text: 'A session' },
          placements: [{ scope_id: 'claude', type: 'relates' }],
        },
        {
          id: 'context',
          name: 'context',
          spec: { ordered: true },
          body: { text: 'Knowledge context' },
          placements: [{ scope_id: 'claude', type: 'relates' }],
        },
        {
          id: 'prompt',
          name: 'prompt',
          body: { text: 'A user message' },
          placements: [{ scope_id: 'claude', type: 'relates' }],
        },
      ],
    })

    // Create a dispatch instance placed on both claude and dispatch
    apply(db, {
      chunks: [
        {
          id: 'my-dispatch',
          name: 'my-dispatch',
          body: { status: 'pending' },
          placements: [
            { scope_id: 'claude', type: 'instance', seq: 1 },
            { scope_id: 'dispatch', type: 'instance' },
          ],
        },
      ],
    })

    // Create typed chunks for the dispatch arguments
    apply(db, {
      chunks: [
        {
          id: 'my-session',
          name: 'my-session',
          body: { text: 'Test session' },
          placements: [{ scope_id: 'session', type: 'instance' }],
        },
        {
          id: 'my-prompt',
          body: { text: 'Hello' },
          placements: [{ scope_id: 'prompt', type: 'instance' }],
        },
        {
          id: 'my-context',
          body: {},
          placements: [{ scope_id: 'context', type: 'instance', seq: 1 }],
        },
        {
          id: 'my-read',
          body: {},
          placements: [{ scope_id: 'read-boundary', type: 'instance' }],
        },
        {
          id: 'my-write',
          body: {},
          placements: [{ scope_id: 'write-boundary', type: 'instance' }],
        },
      ],
    })

    // Place typed chunks on the dispatch — should succeed (all accepted types covered)
    const result = apply(db, {
      chunks: [
        {
          id: 'my-session',
          placements: [{ scope_id: 'my-dispatch', type: 'instance', seq: 1 }],
        },
        {
          id: 'my-prompt',
          placements: [{ scope_id: 'my-dispatch', type: 'instance', seq: 2 }],
        },
        {
          id: 'my-context',
          placements: [{ scope_id: 'my-dispatch', type: 'instance', seq: 3 }],
        },
        {
          id: 'my-read',
          placements: [{ scope_id: 'my-dispatch', type: 'instance', seq: 4 }],
        },
        {
          id: 'my-write',
          placements: [{ scope_id: 'my-dispatch', type: 'instance', seq: 5 }],
        },
      ],
    })

    expect(result.commit.id).toBeTruthy()
  })

  test('propagate: rejects untyped chunk on composed scope', () => {
    const db = open()

    apply(db, {
      chunks: [
        {
          id: 'dispatch',
          name: 'dispatch',
          spec: { propagate: true, accepts: ['read-boundary'] },
          body: {},
        },
        {
          id: 'read-boundary',
          name: 'read-boundary',
          body: {},
          placements: [{ scope_id: 'dispatch', type: 'relates' }],
        },
        {
          id: 'claude',
          name: 'claude',
          spec: { propagate: true, accepts: ['prompt'] },
          body: { executable: './invocables/claude' },
        },
        {
          id: 'prompt',
          name: 'prompt',
          body: {},
          placements: [{ scope_id: 'claude', type: 'relates' }],
        },
      ],
    })

    // Create dispatch on both archetypes
    apply(db, {
      chunks: [
        {
          id: 'my-dispatch',
          body: {},
          placements: [
            { scope_id: 'claude', type: 'instance' },
            { scope_id: 'dispatch', type: 'instance' },
          ],
        },
      ],
    })

    // Try to place an untyped chunk — should fail
    expect(() =>
      apply(db, {
        chunks: [
          {
            body: { text: 'rogue chunk' },
            placements: [{ scope_id: 'my-dispatch', type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('propagate: no composition without propagate flag', () => {
    const db = open()

    // session WITHOUT propagate — its accepts should NOT propagate to instances
    apply(db, {
      chunks: [
        {
          id: 'session',
          name: 'session',
          spec: { ordered: true, accepts: ['prompt'] },
          body: {},
        },
        {
          id: 'prompt',
          name: 'prompt',
          body: {},
          placements: [{ scope_id: 'session', type: 'relates' }],
        },
      ],
    })

    // Create a prompt instance to place on session
    apply(db, {
      chunks: [
        {
          id: 'my-prompt',
          body: { text: 'Hello' },
          placements: [{ scope_id: 'prompt', type: 'instance' }],
        },
      ],
    })

    // Place prompt on session — should succeed (session accepts prompt)
    apply(db, {
      chunks: [
        {
          id: 'my-prompt',
          placements: [{ scope_id: 'session', type: 'instance', seq: 1 }],
        },
      ],
    })

    // Now place anything on the prompt instance — should succeed
    // (session's accepts does NOT propagate to my-prompt's own scope)
    const result = apply(db, {
      chunks: [
        {
          body: { text: 'anything goes on prompt' },
          placements: [{ scope_id: 'my-prompt', type: 'instance' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('propagate: composes ordered from archetype chain', () => {
    const db = open()

    apply(db, {
      chunks: [
        {
          id: 'ordered-archetype',
          name: 'ordered-archetype',
          spec: { propagate: true, ordered: true },
          body: {},
        },
      ],
    })

    apply(db, {
      chunks: [
        {
          id: 'my-instance',
          body: {},
          placements: [{ scope_id: 'ordered-archetype', type: 'instance' }],
        },
      ],
    })

    // Placing without seq auto-assigns (ordered propagated from archetype)
    const autoResult = apply(db, {
      chunks: [
        {
          body: { text: 'no seq' },
          placements: [{ scope_id: 'my-instance', type: 'instance' }],
        },
      ],
    })

    expect(autoResult.chunks[0]!.created).toBe(true)

    // Placing with explicit seq should also succeed
    const result = apply(db, {
      chunks: [
        {
          body: { text: 'with seq' },
          placements: [{ scope_id: 'my-instance', type: 'instance', seq: 10 }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('propagate: composes required from archetype chain', () => {
    const db = open()

    apply(db, {
      chunks: [
        {
          id: 'strict-archetype',
          name: 'strict-archetype',
          spec: { propagate: true, required: ['tool'] },
          body: {},
        },
      ],
    })

    apply(db, {
      chunks: [
        {
          id: 'my-instance',
          body: {},
          placements: [{ scope_id: 'strict-archetype', type: 'instance' }],
        },
      ],
    })

    // Missing required key from archetype — should fail
    expect(() =>
      apply(db, {
        chunks: [
          {
            body: { text: 'no tool key' },
            placements: [{ scope_id: 'my-instance', type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)

    // With required key — should succeed
    const result = apply(db, {
      chunks: [
        {
          body: { tool: 'grep' },
          placements: [{ scope_id: 'my-instance', type: 'instance' }],
        },
      ],
    })

    expect(result.chunks[0]!.created).toBe(true)
  })

  test('single apply: later chunks see earlier chunks for spec enforcement', () => {
    const db = open()

    const result = apply(db, {
      chunks: [
        {
          id: 'arch',
          name: 'arch',
          spec: { accepts: ['allowed-type'] },
          body: {},
        },
        {
          id: 'allowed-type',
          name: 'allowed-type',
          body: { text: 'A type defined in the same transaction' },
          placements: [{ scope_id: 'arch', type: 'relates' }],
        },
        {
          id: 'typed-child',
          body: { text: 'Instance of allowed-type, placed on archetype' },
          placements: [
            { scope_id: 'allowed-type', type: 'instance' },
            { scope_id: 'arch', type: 'instance' },
          ],
        },
      ],
    })

    expect(result.commit.id).toBeTruthy()
    expect(result.chunks).toHaveLength(3)
    expect(result.chunks[0]!.id).toBe('arch')
    expect(result.chunks[1]!.id).toBe('allowed-type')
    expect(result.chunks[2]!.id).toBe('typed-child')
  })

  test('rollback on spec violation leaves no partial state', () => {
    const db = open()
    const s = apply(db, {
      chunks: [{ name: 'strict', spec: { required: ['mandatory'] }, body: {} }],
    })
    const scopeId = s.chunks[0]!.id

    expect(() =>
      apply(db, {
        chunks: [
          { name: 'valid', body: { text: 'this is fine' } },
          {
            body: { text: 'this will fail — missing required key' },
            placements: [{ scope_id: scopeId, type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })

  test('accepts: rejects chunk matching multiple accepted types', () => {
    const db = open()

    // Create a scope that accepts both type-a and type-b
    apply(db, {
      chunks: [
        {
          id: 'multi-scope',
          name: 'multi-scope',
          spec: { accepts: ['type-a', 'type-b'] },
          body: {},
        },
        {
          id: 'type-a',
          name: 'type-a',
          body: {},
          placements: [{ scope_id: 'multi-scope', type: 'relates' }],
        },
        {
          id: 'type-b',
          name: 'type-b',
          body: {},
          placements: [{ scope_id: 'multi-scope', type: 'relates' }],
        },
      ],
    })

    // Create a chunk that is instance of BOTH type-a and type-b
    apply(db, {
      chunks: [
        {
          id: 'ambiguous-chunk',
          body: { text: 'I match two types' },
          placements: [
            { scope_id: 'type-a', type: 'instance' },
            { scope_id: 'type-b', type: 'instance' },
          ],
        },
      ],
    })

    // Placing on multi-scope should fail — ambiguous type match
    expect(() =>
      apply(db, {
        chunks: [
          {
            id: 'ambiguous-chunk',
            placements: [{ scope_id: 'multi-scope', type: 'instance' }],
          },
        ],
      }),
    ).toThrow(SpecViolation)
  })
})
