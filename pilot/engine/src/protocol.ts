import { apply, scope, search, SpecViolation } from '../../ol/src/index.ts'
import type { ChunkDeclaration } from '../../ol/src/types.ts'
import type {
  DispatchContext,
  DispatchArgs,
  ProtocolResponse,
  ProtocolErrorCode,
} from './types.ts'
import { checkReadAccess, checkWriteAccess, isProtected } from './boundary.ts'
import { createDispatch } from './dispatch.ts'

type ParsedRequest =
  | { id: number; op: 'scope'; scopes: string[] }
  | { id: number; op: 'search'; query: string }
  | { id: number; op: 'apply'; declaration: { chunks: ChunkDeclaration[] } }
  | { id: number; op: 'dispatch'; invocable: string; args: DispatchArgs }
  | { id: number; op: 'await'; dispatches: string[] }

type ParseError = { error: { code: ProtocolErrorCode; message: string } }

const VALID_OPS = new Set(['scope', 'search', 'apply', 'dispatch', 'await'])

/** Parse a JSON line into a typed protocol request. */
export const parseRequest = (line: string): ParsedRequest | ParseError => {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return { error: { code: 'INVALID_REQUEST', message: 'Malformed JSON' } }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { error: { code: 'INVALID_REQUEST', message: 'Expected JSON object' } }
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.id !== 'number') {
    return { error: { code: 'INVALID_REQUEST', message: 'Missing or invalid id' } }
  }

  if (typeof obj.op !== 'string' || !VALID_OPS.has(obj.op)) {
    return {
      error: { code: 'INVALID_REQUEST', message: `Unknown or missing op: ${String(obj.op)}` },
    }
  }

  return obj as unknown as ParsedRequest
}

const errorResponse = (
  id: number,
  code: ProtocolErrorCode,
  message: string,
): ProtocolResponse => ({
  id,
  error: { code, message },
})

/** Handle a parsed protocol operation against the dispatch context. */
export const handleOp = (
  ctx: DispatchContext,
  request: ParsedRequest,
): ProtocolResponse => {
  switch (request.op) {
    case 'scope':
      return handleScope(ctx, request)
    case 'search':
      return handleSearch(ctx, request)
    case 'apply':
      return handleApply(ctx, request)
    case 'dispatch':
      return handleDispatch(ctx, request)
    case 'await':
      return handleAwait(ctx, request)
  }
}

const handleScope = (
  ctx: DispatchContext,
  req: { id: number; scopes: string[] },
): ProtocolResponse => {
  // Check all requested scopes against read boundary
  for (const scopeId of req.scopes) {
    if (!checkReadAccess(ctx, scopeId)) {
      return errorResponse(
        req.id,
        'BOUNDARY_VIOLATION',
        `Read rejected: scope ${scopeId} is outside read boundary`,
      )
    }
  }

  const result = scope(ctx.db, req.scopes)
  return { id: req.id, result }
}

const handleSearch = (
  ctx: DispatchContext,
  req: { id: number; query: string },
): ProtocolResponse => {
  // Search returns all matches; boundary filtering would need post-filter
  // For now return all results — boundary is checked on scope reads
  const result = search(ctx.db, req.query)
  return { id: req.id, result }
}

const handleApply = (
  ctx: DispatchContext,
  req: { id: number; declaration: { chunks: ChunkDeclaration[] } },
): ProtocolResponse => {
  // Check for protected chunk modifications
  for (const chunk of req.declaration.chunks) {
    if (chunk.id && isProtected(ctx, chunk.id)) {
      return errorResponse(
        req.id,
        'BOUNDARY_VIOLATION',
        `Write rejected: chunk ${chunk.id} is protected`,
      )
    }
  }

  // Check all placement scopes against write boundary
  for (const chunk of req.declaration.chunks) {
    for (const placement of chunk.placements ?? []) {
      if (!checkWriteAccess(ctx, placement.scope_id)) {
        return errorResponse(
          req.id,
          'BOUNDARY_VIOLATION',
          `Write rejected: scope ${placement.scope_id} is outside write boundary`,
        )
      }
    }
  }

  try {
    const result = apply(ctx.db, req.declaration, { dispatch: ctx.dispatchId })
    return { id: req.id, result }
  } catch (e) {
    if (e instanceof SpecViolation) {
      return errorResponse(req.id, 'VALIDATION_ERROR', e.message)
    }
    throw e
  }
}

const handleDispatch = (
  ctx: DispatchContext,
  req: { id: number; invocable: string; args: DispatchArgs },
): ProtocolResponse => {
  try {
    const result = createDispatch(ctx.db, req.invocable, req.args)
    return { id: req.id, result: { dispatch: result.dispatchId } }
  } catch (e) {
    return errorResponse(req.id, 'NOT_FOUND', (e as Error).message)
  }
}

const handleAwait = (
  _ctx: DispatchContext,
  req: { id: number; dispatches: string[] },
): ProtocolResponse => {
  // Await is handled at the process level, not here.
  // This stub exists for protocol completeness — the real await
  // blocks until dispatches complete, which requires process management.
  return errorResponse(
    req.id,
    'INVALID_REQUEST',
    `Await not yet implemented (dispatches: ${req.dispatches.join(', ')})`,
  )
}

/** Serialize a protocol response as a JSON line (with trailing newline). */
export const formatResponse = (response: ProtocolResponse): string => {
  return JSON.stringify(response) + '\n'
}
