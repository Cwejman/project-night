#!/usr/bin/env bun

import { open } from './db.ts'
import { apply } from './apply.ts'
import { scope, search, log } from './read.ts'
import type { Declaration } from './types.ts'

const args = process.argv.slice(2)
const command = args[0]
const sub = args[1]

const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const dbPath = flag('db') ?? process.env['OL_DB'] ?? '.openlight/db'

const json = (data: unknown) => console.log(JSON.stringify(data, null, 2))

const fail = (msg: string): never => {
  console.error(msg)
  process.exit(1)
}

const run = () => {
  if (command === 'init') {
    const fs = require('fs')
    const path = require('path')
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    open(dbPath)
    json({ ok: true, db: dbPath })
    return
  }

  const db = open(dbPath)

  if (command === 'apply') {
    const input = flag('input')
    let raw: string
    if (input) {
      raw = input
    } else {
      raw = require('fs').readFileSync('/dev/stdin', 'utf8')
    }
    const declaration = JSON.parse(raw) as Declaration
    const result = apply(db, declaration)
    json(result)
    return
  }

  if (command === 'scope') {
    const scopeIds = args.slice(1).filter((a) => !a.startsWith('--'))
    const result = scope(db, scopeIds)
    json(result)
    return
  }

  if (command === 'search') {
    const query = args.slice(1).join(' ')
    if (!query) fail('Usage: ol search <query>')
    const results = search(db, query)
    json(results)
    return
  }

  if (command === 'branch' && sub === 'create') {
    const name = args[2]
    if (!name) fail('Usage: ol branch create <name>')
    const head = db
      .query<{ head: string }, [string]>('SELECT head FROM branches WHERE name = ?')
      .get('main')
    if (!head) fail('No main branch')
    db.run('INSERT INTO branches (name, head) VALUES (?, ?)', [name, head.head])
    json({ ok: true, branch: name, head: head.head })
    return
  }

  if (command === 'branch' && sub === 'list') {
    const rows = db
      .query<{ name: string; head: string }, []>('SELECT name, head FROM branches')
      .all()
    json(rows)
    return
  }

  if (command === 'log') {
    const limitRaw = flag('limit')
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50
    const commits = log(db, limit)
    json(commits)
    return
  }

  fail(
    `Unknown command: ${command} ${sub ?? ''}

Commands:
  ol init                  Create a new database
  ol apply                 Declarative mutation (JSON from stdin or --input)
  ol scope [id...]         Scope query — returns scope chunks, contents, connected scopes
  ol search <query>        Full-text search
  ol branch create <name>  Create a branch
  ol branch list           List branches
  ol log [--limit N]       Commit history

Flags:
  --db PATH    Database path (default: .openlight/db)
  --input JSON Inline JSON for apply (alternative to stdin)
  OL_DB env    Alternative to --db`,
  )
}

try {
  run()
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message)
    process.exit(e.name === 'SpecViolation' ? 1 : 2)
  }
  throw e
}
