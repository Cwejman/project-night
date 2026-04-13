/**
 * Client library for invocables. Wraps stdin/stdout JSON lines protocol
 * with typed functions. Invocables import this, not raw IO.
 */
import type {
  ChunkDeclaration,
  ScopeResult,
  ApplyResult,
} from '../ol/src/types.ts'

type ProtocolResponse = {
  id: number
  result?: unknown
  error?: { code: string; message: string }
}

let requestId = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
let stdinReader: ReadableStreamDefaultReader<Uint8Array> | null = null
let buffer = ''
const decoder = new TextDecoder()

const startReading = () => {
  if (stdinReader) return
  stdinReader = Bun.stdin.stream().getReader()

  const read = async () => {
    try {
      while (true) {
        const { done, value } = await stdinReader!.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const response = JSON.parse(line) as ProtocolResponse
            const handler = pending.get(response.id)
            if (handler) {
              pending.delete(response.id)
              if (response.error) {
                handler.reject(new Error(`${response.error.code}: ${response.error.message}`))
              } else {
                handler.resolve(response.result)
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch {
      // stdin closed
    }
  }

  read()
}

const send = <T>(request: Record<string, unknown>): Promise<T> => {
  startReading()
  const id = ++requestId
  const line = JSON.stringify({ id, ...request }) + '\n'
  process.stdout.write(line)

  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    })
  }) as Promise<T>
}

/** The dispatch ID for this invocable (from command-line argument). */
export const dispatchId = process.argv[2]!

/** Read scope, filtered by the engine's read boundary. */
export const readScope = (scopes: string[]): Promise<ScopeResult> =>
  send<ScopeResult>({ op: 'scope', scopes })

/** Full-text search, filtered by read boundary. */
export const searchChunks = (query: string): Promise<unknown[]> =>
  send<unknown[]>({ op: 'search', query })

/** Write chunks, checked against write boundary. */
export const writeApply = (chunks: ChunkDeclaration[]): Promise<ApplyResult> =>
  send<ApplyResult>({ op: 'apply', declaration: { chunks } })

/** Dispatch another invocable. Returns dispatch chunk ID immediately. */
export const dispatchInvocable = (
  invocable: string,
  args: {
    chunks: ChunkDeclaration[]
    readBoundary: string[]
    writeBoundary: string[]
    timeout?: number
  },
): Promise<{ dispatch: string }> =>
  send<{ dispatch: string }>({ op: 'dispatch', invocable, args })

/** Block until one or more dispatches complete. Returns results. */
export const awaitDispatches = (
  dispatches: string[],
): Promise<Record<string, ScopeResult>> =>
  send<Record<string, ScopeResult>>({ op: 'await', dispatches })
