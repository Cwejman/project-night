import { apply } from '../../ol/src/index.ts'
import type { Engine, DispatchContext, ProcessHandle } from './types.ts'
import { parseRequest, handleOp, formatResponse } from './protocol.ts'

/** Update the dispatch chunk's status via apply(). */
const updateStatus = (
  ctx: DispatchContext,
  status: 'running' | 'completed' | 'failed',
  extra?: Record<string, unknown>,
): void => {
  apply(
    ctx.db,
    {
      chunks: [
        {
          id: ctx.dispatchId,
          body: { status, ...extra },
        },
      ],
    },
    { dispatch: ctx.dispatchId },
  )
}

/** Process stdout lines from the invocable. */
const processLine = (
  engine: Engine,
  ctx: DispatchContext,
  handle: ProcessHandle,
  line: string,
): void => {
  const parsed = parseRequest(line)

  if ('error' in parsed) {
    // Malformed request — kill the process
    handle.process.kill()
    updateStatus(ctx, 'failed', { error: 'protocol: malformed output' })
    engine.processes.delete(ctx.dispatchId)
    if (handle.timeout) clearTimeout(handle.timeout)
    return
  }

  const response = handleOp(ctx, parsed)
  const responseLine = formatResponse(response)

  try {
    handle.process.stdin.write(responseLine)
  } catch {
    // stdin closed — process is exiting
  }
}

/** Read stdout from the subprocess line by line. */
const readStdout = async (
  engine: Engine,
  ctx: DispatchContext,
  handle: ProcessHandle,
): Promise<void> => {
  const reader = handle.process.stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()! // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          processLine(engine, ctx, handle, line)
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      processLine(engine, ctx, handle, buffer)
    }
  } catch {
    // Stream error — process likely exited
  }
}

/**
 * Spawn an invocable as a local subprocess.
 * Pipes stdin/stdout for the JSON lines protocol.
 */
export const spawnInvocable = (
  engine: Engine,
  ctx: DispatchContext,
  executable: string,
  timeoutMs?: number,
): ProcessHandle => {
  const proc = Bun.spawn(['bun', 'run', executable, ctx.dispatchId], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'inherit',
  })

  // Set status to running
  updateStatus(ctx, 'running', { pid: proc.pid, started: new Date().toISOString() })

  let timeout: ReturnType<typeof setTimeout> | undefined

  const handle: ProcessHandle = {
    dispatchId: ctx.dispatchId,
    process: proc,
    get timeout() {
      return timeout
    },
  }

  engine.processes.set(ctx.dispatchId, handle)

  // Set up timeout
  if (timeoutMs) {
    timeout = setTimeout(() => {
      proc.kill()
      updateStatus(ctx, 'failed', { error: 'timeout' })
      engine.processes.delete(ctx.dispatchId)
    }, timeoutMs)
  }

  // Start reading stdout (async, non-blocking)
  readStdout(engine, ctx, handle)

  // Handle process exit
  proc.exited.then((exitCode) => {
    if (timeout) clearTimeout(timeout)

    // Only update status if still tracked (not already handled by timeout/cancel)
    if (engine.processes.has(ctx.dispatchId)) {
      if (exitCode === 0) {
        updateStatus(ctx, 'completed')
      } else {
        updateStatus(ctx, 'failed')
      }
      engine.processes.delete(ctx.dispatchId)
    }
  })

  return handle
}

/** Cancel a running dispatch by killing its process. */
export const cancelProcess = (engine: Engine, dispatchId: string): void => {
  const handle = engine.processes.get(dispatchId)
  if (!handle) return

  if (handle.timeout) clearTimeout(handle.timeout)
  handle.process.kill()
  engine.processes.delete(dispatchId)

  // Build a minimal context for status update
  apply(
    engine.db,
    { chunks: [{ id: dispatchId, body: { status: 'failed', error: 'cancelled' } }] },
    { dispatch: dispatchId },
  )
}

/** Shutdown all running processes. */
export const shutdownAll = (engine: Engine): void => {
  for (const [dispatchId, handle] of engine.processes) {
    if (handle.timeout) clearTimeout(handle.timeout)
    handle.process.kill()
    apply(
      engine.db,
      { chunks: [{ id: dispatchId, body: { status: 'failed', error: 'engine shutdown' } }] },
      { dispatch: dispatchId },
    )
  }
  engine.processes.clear()
}
