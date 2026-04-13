// Integration fixture: uses the client library to write a result chunk on its dispatch scope.
import { dispatchId, writeApply } from '../client.ts'

const result = await writeApply([
  {
    body: { text: 'written by client', marker: 'client-write-test' },
    placements: [{ scope_id: dispatchId, type: 'relates' }],
  },
])
process.stderr.write(`Commit: ${result.commit.id}\n`)
process.exit(0)
