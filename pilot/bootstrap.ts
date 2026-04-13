import { mkdirSync } from 'fs'
import { open, apply, scope } from './ol/src/index'
import type { Declaration } from './ol/src/index'

mkdirSync('project/.ol', { recursive: true })

const db = open('project/.ol/db')

// ═══ Commit 1: Engine — as if from a peer ═══
// Runtime contracts and primitives. In a peered system these come from
// the engine's own database, mounted into the project.

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

// ═══ Commit 2: UI — as if from a peer ═══
// Tiling primitives. In a peered system these come from the UI module's
// own database.

const ui: Declaration = {
  chunks: [
    { id: 'ui', name: 'ui', body: { text: 'UI domain' } },

    {
      id: 'split',
      name: 'split',
      spec: { ordered: true },
      body: { text: 'A split tile node' },
      placements: [{ scope_id: 'ui', type: 'instance' }],
    },
    {
      id: 'leaf',
      name: 'leaf',
      body: { text: 'A leaf tile node' },
      placements: [{ scope_id: 'ui', type: 'instance' }],
    },
    {
      id: 'view-root',
      name: 'view-root',
      body: {},
      placements: [
        { scope_id: 'ui', type: 'instance' },
        { scope_id: 'leaf', type: 'instance' },
      ],
    },
    {
      id: 'scope-history',
      name: 'scope-history',
      body: {},
      placements: [{ scope_id: 'ui', type: 'instance' }],
    },
  ],
}

// ═══ Commit 3: Agent — the project ═══
// Session types, tool invocables, and their type definitions.
// This is the project's own data. It references engine contracts
// (invocable, dispatch) by placing instances on them.

const agent: Declaration = {
  chunks: [
    { id: 'agent', name: 'agent', body: { text: 'Project tools and abstractions' } },

    // Session types
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

    // Invocables — project tools, instances of engine's invocable contract
    {
      id: 'filesystem',
      name: 'filesystem',
      spec: { propagate: true, accepts: ['fs-command'] },
      body: {
        text: 'Read and write files',
        executable: './invocables/filesystem',
        boundary: 'dispatch',
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
      body: {
        text: 'A filesystem operation',
        schema: {
          operation: {
            type: 'string',
            enum: ['read', 'write', 'edit', 'glob', 'grep'],
          },
          path: { type: 'string', description: 'File or directory path' },
        },
      },
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
      body: {
        text: 'A shell command',
        schema: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
      },
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
      body: {
        text: 'An HTTP request',
        schema: {
          url: { type: 'string', description: 'URL to fetch' },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE'],
          },
        },
      },
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

// Three commits — simulating three peers
const r1 = apply(db, engine)
console.log(`engine:  ${r1.chunks.filter((c) => c.created).length} chunks, commit ${r1.commit.id}`)

const r2 = apply(db, ui)
console.log(`ui:      ${r2.chunks.filter((c) => c.created).length} chunks, commit ${r2.commit.id}`)

const r3 = apply(db, agent)
console.log(`agent:   ${r3.chunks.filter((c) => c.created).length} chunks, commit ${r3.commit.id}`)

// Verify
console.log()
for (const root of ['engine', 'agent', 'ui']) {
  const s = scope(db, [root])
  console.log(`${root}: ${s.chunks.instance} instance, ${s.chunks.relates} relates`)
  s.chunks.items.forEach((c) => {
    const other = c.placements
      .filter((p) => p.scope_id !== root)
      .map((p) => `${p.type} on ${p.scope_id}`)
    const info = other.length ? `  (${other.join(', ')})` : ''
    console.log(`  ${c.name ?? c.id}${info}`)
  })
  console.log()
}
