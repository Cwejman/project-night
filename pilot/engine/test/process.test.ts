import { describe, test, expect } from 'bun:test'
import { resolve } from 'path'
import { scope, apply } from '../../ol/src/index.ts'
import { seedTestDb } from './helpers.ts'
import { createDispatch } from '../src/dispatch.ts'
import { buildDispatchContext } from '../src/boundary.ts'
import { spawnInvocable, cancelProcess, shutdownAll } from '../src/process.ts'
import type { Engine } from '../src/types.ts'

const fixture = (name: string) => resolve(import.meta.dir, '..', 'fixtures', name)

const makeEngine = (dbPath?: string): Engine => {
  const db = seedTestDb()
  return { db, processes: new Map() }
}

/** Create a dispatch and return engine + context + dispatchId. */
const setupDispatch = (invocableId: string, executable: string) => {
  const engine = makeEngine()
  const { dispatchId } = createDispatch(engine.db, invocableId, {
    chunks: [],
    readBoundary: ['agent'],
    writeBoundary: ['agent'],
  })
  const ctx = buildDispatchContext(engine.db, dispatchId, invocableId)
  return { engine, ctx, dispatchId, executable }
}

describe('process lifecycle', () => {
  test('spawnInvocable starts a subprocess and returns a handle', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('echo.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('echo.ts'))
    expect(handle.dispatchId).toBe(dispatchId)
    expect(handle.process.pid).toBeTruthy()

    // Clean up
    handle.process.kill()
    await handle.process.exited
  })

  test('exit 0 sets status to completed', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('echo.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('echo.ts'))

    // Close stdin to let echo exit cleanly
    handle.process.stdin.end()
    await handle.process.exited

    // Give a tick for status update
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const dispatch = result.scope[0]!
    expect((dispatch.body as Record<string, unknown>).status).toBe('completed')
  })

  test('non-zero exit sets status to failed', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('crash.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('crash.ts'))

    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const dispatch = result.scope[0]!
    expect((dispatch.body as Record<string, unknown>).status).toBe('failed')
  })

  test('invocable receives dispatch ID as argv', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('scope-read.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('scope-read.ts'))

    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const dispatch = result.scope[0]!
    expect((dispatch.body as Record<string, unknown>).status).toBe('completed')
  })

  test('cancel kills running process and sets status to failed', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('hang.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('hang.ts'))

    // Process should be running
    expect(handle.process.exitCode).toBeNull()

    cancelProcess(engine, dispatchId)
    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const dispatch = result.scope[0]!
    expect((dispatch.body as Record<string, unknown>).status).toBe('failed')
  })

  test('timeout kills process', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('hang.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('hang.ts'), 200)

    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const dispatch = result.scope[0]!
    const body = dispatch.body as Record<string, unknown>
    expect(body.status).toBe('failed')
    expect(body.error).toBe('timeout')
  })

  test('malformed stdout kills process', async () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('garbage.ts'))
    const handle = spawnInvocable(engine, ctx, fixture('garbage.ts'))

    await handle.process.exited
    await new Promise((r) => setTimeout(r, 50))

    const result = scope(engine.db, [dispatchId])
    const dispatch = result.scope[0]!
    const body = dispatch.body as Record<string, unknown>
    expect(body.status).toBe('failed')
    expect(String(body.error)).toContain('protocol')
  })

  test('status transitions from pending to running on spawn', () => {
    const { engine, ctx, dispatchId } = setupDispatch('claude', fixture('hang.ts'))

    // Before spawn, status is pending
    let result = scope(engine.db, [dispatchId])
    expect((result.scope[0]!.body as Record<string, unknown>).status).toBe('pending')

    const handle = spawnInvocable(engine, ctx, fixture('hang.ts'))

    // After spawn, status should be running
    result = scope(engine.db, [dispatchId])
    expect((result.scope[0]!.body as Record<string, unknown>).status).toBe('running')

    handle.process.kill()
  })

  test('shutdown kills all running processes', async () => {
    const engine = makeEngine()

    // Create two dispatches
    const r1 = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx1 = buildDispatchContext(engine.db, r1.dispatchId, 'claude')
    const h1 = spawnInvocable(engine, ctx1, fixture('hang.ts'))

    const r2 = createDispatch(engine.db, 'claude', {
      chunks: [],
      readBoundary: ['agent'],
      writeBoundary: ['agent'],
    })
    const ctx2 = buildDispatchContext(engine.db, r2.dispatchId, 'claude')
    const h2 = spawnInvocable(engine, ctx2, fixture('hang.ts'))

    expect(engine.processes.size).toBe(2)

    shutdownAll(engine)

    await Promise.all([h1.process.exited, h2.process.exited])
    await new Promise((r) => setTimeout(r, 50))

    expect(engine.processes.size).toBe(0)

    const s1 = scope(engine.db, [r1.dispatchId])
    expect((s1.scope[0]!.body as Record<string, unknown>).status).toBe('failed')

    const s2 = scope(engine.db, [r2.dispatchId])
    expect((s2.scope[0]!.body as Record<string, unknown>).status).toBe('failed')
  })
})
