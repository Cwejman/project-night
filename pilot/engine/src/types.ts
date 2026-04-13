import type { Db, ChunkDeclaration } from '../../ol/src/types.ts'

export type Engine = {
  readonly db: Db
  /** Running dispatches tracked for cancel/shutdown. */
  readonly processes: Map<string, ProcessHandle>
}

export type DispatchArgs = {
  /** Chunks to place on the dispatch, as assembled by the UI. */
  readonly chunks: readonly ChunkDeclaration[]
  /** Scope IDs for the read boundary. */
  readonly readBoundary: readonly string[]
  /** Scope IDs for the write boundary. */
  readonly writeBoundary: readonly string[]
  /** Timeout in ms. Defaults to invocable's body.timeout_ms if not provided. */
  readonly timeout?: number
}

export type DispatchResult = {
  readonly dispatchId: string
}

export type DispatchContext = {
  readonly db: Db
  readonly dispatchId: string
  readonly readBoundaryRoots: readonly string[]
  readonly writeBoundaryRoots: readonly string[]
  readonly protectedChunkIds: ReadonlySet<string>
  readonly invocableId: string
}

export type ProcessHandle = {
  readonly dispatchId: string
  readonly process: import('bun').Subprocess
  readonly timeout?: ReturnType<typeof setTimeout>
}

// ── Protocol types ──

export type ProtocolRequest =
  | { readonly id: number; readonly op: 'scope'; readonly scopes: readonly string[] }
  | { readonly id: number; readonly op: 'search'; readonly query: string }
  | { readonly id: number; readonly op: 'apply'; readonly declaration: { readonly chunks: readonly ChunkDeclaration[] } }
  | { readonly id: number; readonly op: 'dispatch'; readonly invocable: string; readonly args: DispatchArgs }
  | { readonly id: number; readonly op: 'await'; readonly dispatches: readonly string[] }

export type ProtocolResponse =
  | { readonly id: number; readonly result: unknown }
  | { readonly id: number; readonly error: { readonly code: string; readonly message: string } }

export type ProtocolErrorCode =
  | 'BOUNDARY_VIOLATION'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DISPATCH_FAILED'
  | 'INVALID_REQUEST'
