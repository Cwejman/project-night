// Scope-read invocable: sends a scope request for its dispatch ID, reads one response, exits 0.
const dispatchId = process.argv[2]
if (!dispatchId) {
  process.stderr.write('Missing dispatch ID argument\n')
  process.exit(1)
}

// Send scope request
const request = JSON.stringify({ id: 1, op: 'scope', scopes: [dispatchId] })
process.stdout.write(request + '\n')

// Read one response
const decoder = new TextDecoder()
for await (const chunk of Bun.stdin.stream()) {
  const lines = decoder.decode(chunk).split('\n').filter(Boolean)
  if (lines.length > 0) {
    process.stderr.write('Got response: ' + lines[0] + '\n')
    break
  }
}

process.exit(0)
