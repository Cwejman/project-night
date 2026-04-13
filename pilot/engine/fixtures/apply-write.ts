// Apply-write invocable: sends an apply to write a result chunk on its dispatch scope, exits 0.
const dispatchId = process.argv[2]
if (!dispatchId) {
  process.stderr.write('Missing dispatch ID argument\n')
  process.exit(1)
}

// Send apply request — write a result chunk on the dispatch scope
const request = JSON.stringify({
  id: 1,
  op: 'apply',
  declaration: {
    chunks: [
      {
        body: { text: 'result from invocable', written: true },
        placements: [{ scope_id: dispatchId, type: 'relates' }],
      },
    ],
  },
})
process.stdout.write(request + '\n')

// Read one response
const decoder = new TextDecoder()
for await (const chunk of Bun.stdin.stream()) {
  const lines = decoder.decode(chunk).split('\n').filter(Boolean)
  if (lines.length > 0) {
    const response = JSON.parse(lines[0]!)
    if (response.error) {
      process.stderr.write('Apply error: ' + JSON.stringify(response.error) + '\n')
      process.exit(1)
    }
    break
  }
}

process.exit(0)
