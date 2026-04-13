import { open, apply } from '../../ol/src/index.ts'
import type { Db, Declaration } from '../../ol/src/index.ts'

/** Seeds engine + agent archetypes with human-readable IDs, matching bootstrap.ts. */
export function seedTestDb(): Db {
  const db = open()

  const engine: Declaration = {
    chunks: [
      { id: 'engine', name: 'engine', body: { text: 'Runtime contracts and primitives' } },
      {
        id: 'invocable',
        name: 'invocable',
        spec: { required: ['executable'] },
        body: { text: 'An executable program' },
        placements: [{ scope_id: 'engine', type: 'instance' }],
      },
      {
        id: 'dispatch',
        name: 'dispatch',
        spec: { propagate: true, accepts: ['read-boundary', 'write-boundary'] },
        body: { text: 'A dispatch event' },
        placements: [{ scope_id: 'engine', type: 'instance' }],
      },
      {
        id: 'read-boundary',
        name: 'read-boundary',
        body: { text: 'Scopes the invocable can read' },
        placements: [
          { scope_id: 'engine', type: 'instance' },
          { scope_id: 'dispatch', type: 'relates' },
        ],
      },
      {
        id: 'write-boundary',
        name: 'write-boundary',
        body: { text: 'Scopes the invocable can write to' },
        placements: [
          { scope_id: 'engine', type: 'instance' },
          { scope_id: 'dispatch', type: 'relates' },
        ],
      },
    ],
  }

  const agent: Declaration = {
    chunks: [
      { id: 'agent', name: 'agent', body: { text: 'Project tools and abstractions' } },

      {
        id: 'session',
        name: 'session',
        spec: {
          propagate: true,
          ordered: true,
          accepts: ['prompt', 'answer', 'tool-call', 'tool-result', 'context'],
        },
        body: { text: 'A sequence of agent interaction events' },
        placements: [{ scope_id: 'agent', type: 'instance' }],
      },
      {
        id: 'prompt',
        name: 'prompt',
        body: { text: 'A user message to an agent' },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'session', type: 'relates' },
        ],
      },
      {
        id: 'answer',
        name: 'answer',
        body: { text: 'An agent response' },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'session', type: 'relates' },
        ],
      },
      {
        id: 'tool-call',
        name: 'tool-call',
        spec: { required: ['invocable'] },
        body: { text: 'An agent invoking a tool' },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'session', type: 'relates' },
        ],
      },
      {
        id: 'tool-result',
        name: 'tool-result',
        spec: { required: ['invocable'] },
        body: { text: 'The result of a tool invocation' },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'session', type: 'relates' },
        ],
      },
      {
        id: 'context',
        name: 'context',
        spec: { ordered: true },
        body: { text: 'The knowledge context for a turn' },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'session', type: 'relates' },
        ],
      },

      {
        id: 'filesystem',
        name: 'filesystem',
        spec: { propagate: true, accepts: ['fs-command'] },
        body: {
          text: 'Read and write files',
          executable: './invocables/filesystem',
          boundary: 'dispatch',
          timeout_ms: 30000,
        },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'invocable', type: 'instance' },
        ],
      },
      {
        id: 'fs-command',
        name: 'fs-command',
        spec: { required: ['operation', 'path'] },
        body: { text: 'A filesystem operation' },
        placements: [{ scope_id: 'filesystem', type: 'relates' }],
      },

      {
        id: 'shell',
        name: 'shell',
        spec: { propagate: true, accepts: ['shell-command'] },
        body: {
          text: 'Execute shell commands',
          executable: './invocables/shell',
          boundary: 'dispatch',
          timeout_ms: 30000,
        },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'invocable', type: 'instance' },
        ],
      },
      {
        id: 'shell-command',
        name: 'shell-command',
        spec: { required: ['command'] },
        body: { text: 'A shell command' },
        placements: [{ scope_id: 'shell', type: 'relates' }],
      },

      {
        id: 'web',
        name: 'web',
        spec: { propagate: true, accepts: ['web-request'] },
        body: {
          text: 'Make HTTP requests',
          executable: './invocables/web',
          boundary: 'dispatch',
          timeout_ms: 30000,
        },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'invocable', type: 'instance' },
        ],
      },
      {
        id: 'web-request',
        name: 'web-request',
        spec: { required: ['url'] },
        body: { text: 'An HTTP request' },
        placements: [{ scope_id: 'web', type: 'relates' }],
      },

      {
        id: 'claude',
        name: 'claude',
        spec: {
          propagate: true,
          ordered: true,
          accepts: ['session', 'context', 'prompt'],
        },
        body: {
          text: 'Claude agent',
          executable: './invocables/claude',
          boundary: 'open',
          timeout_ms: 300000,
        },
        placements: [
          { scope_id: 'agent', type: 'instance' },
          { scope_id: 'invocable', type: 'instance' },
        ],
      },

      // Claude's type refs
      { id: 'session', placements: [{ scope_id: 'claude', type: 'relates' }] },
      { id: 'context', placements: [{ scope_id: 'claude', type: 'relates' }] },
      { id: 'prompt', placements: [{ scope_id: 'claude', type: 'relates' }] },
    ],
  }

  apply(db, engine)
  apply(db, agent)

  return db
}
