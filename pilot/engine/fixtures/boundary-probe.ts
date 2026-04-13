// Boundary-probe invocable: sends a scope request for 'engine' (expected outside boundary),
// expects a BOUNDARY_VIOLATION error, then exits 0.
const request = JSON.stringify({ id: 1, op: 'scope', scopes: ['engine'] })
process.stdout.write(request + '\n')

const decoder = new TextDecoder()
for await (const chunk of Bun.stdin.stream()) {
  const lines = decoder.decode(chunk).split('\n').filter(Boolean)
  if (lines.length > 0) {
    const response = JSON.parse(lines[0]!)
    if (response.error?.code === 'BOUNDARY_VIOLATION') {
      process.stderr.write('Got expected boundary violation\n')
      process.exit(0)
    } else {
      process.stderr.write('Unexpected response: ' + lines[0] + '\n')
      process.exit(1)
    }
  }
}
