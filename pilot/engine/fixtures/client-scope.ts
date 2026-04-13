// Integration fixture: uses the client library to read its own dispatch scope.
import { dispatchId, readScope } from '../client.ts'

const result = await readScope([dispatchId])
process.stderr.write(`Scope items: ${result.chunks.items.length}\n`)
process.exit(0)
