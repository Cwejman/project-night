import { describe, test, expect } from 'bun:test'
import { resolve } from 'path'
import { scope } from '../../ol/src/index.ts'
import { seedTestDb } from './helpers.ts'
import { createDispatch } from '../src/dispatch.ts'
import { buildDispatchContext } from '../src/boundary.ts'
import { spawnInvocable } from '../src/process.ts'
import type { Engine } from '../src/types.ts'

const fixture = (name: string) => resolve(import.meta.dir, '..', 'fixtures', name)

const makeEngine = (): Engine => {
  const db = seedTestDb()
  return { db, processes: new Map() }
}

describe('integration', () => {
  test('full dispatch cycle: scope-read fixture reads dispatch scope, exits 0', async () => {
    const engine = makeEngine()
    const { dispatchId } = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx = buildDispatchContext(engine.db, dispatchId, 'claude')
    const handle = spawnInvocable(engine, ctx, fixture('scope-read.ts'))

    const exitCode = await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    expect(exitCode).toBe(0)
    const result = scope(engine.db, [dispatchId])
    expect((result.scope[0]!.body as Record<string, unknown>).status).toBe('completed')
  })

  test('invocable writes to dispatch scope, data persists after completion', async () => {
    const engine = makeEngine()
    const { dispatchId } = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx = buildDispatchContext(engine.db, dispatchId, 'claude')
    const handle = spawnInvocable(engine, ctx, fixture('apply-write.ts'))

    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const written = result.chunks.items.find(
      (c) => (c.body as Record<string, unknown>).written === true,
    )
    expect(written).toBeDefined()
    expect((written!.body as Record<string, unknown>).text).toBe('result from invocable')
  })

  test('boundary violation returns error, process continues and exits 0', async () => {
    const engine = makeEngine()
    const { dispatchId } = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx = buildDispatchContext(engine.db, dispatchId, 'claude')
    const handle = spawnInvocable(engine, ctx, fixture('boundary-probe.ts'))

    const exitCode = await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    expect(exitCode).toBe(0)
    const result = scope(engine.db, [dispatchId])
    expect((result.scope[0]!.body as Record<string, unknown>).status).toBe('completed')
  })

  test('client library: invocable reads scope via client', async () => {
    const engine = makeEngine()
    const { dispatchId } = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx = buildDispatchContext(engine.db, dispatchId, 'claude')
    const handle = spawnInvocable(engine, ctx, fixture('client-scope.ts'))

    const exitCode = await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    expect(exitCode).toBe(0)
    const result = scope(engine.db, [dispatchId])
    expect((result.scope[0]!.body as Record<string, unknown>).status).toBe('completed')
  })

  test('client library: invocable writes via client, data persists', async () => {
    const engine = makeEngine()
    const { dispatchId } = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx = buildDispatchContext(engine.db, dispatchId, 'claude')
    const handle = spawnInvocable(engine, ctx, fixture('client-write.ts'))

    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const written = result.chunks.items.find(
      (c) => (c.body as Record<string, unknown>).marker === 'client-write-test',
    )
    expect(written).toBeDefined()
    expect((written!.body as Record<string, unknown>).text).toBe('written by client')
  })
})
