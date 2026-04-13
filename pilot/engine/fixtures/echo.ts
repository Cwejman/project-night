// Echo invocable: reads JSON lines from stdin, echoes each back with result: { echo: true }
// Exits cleanly when stdin closes.

const decoder = new TextDecoder()

for await (const chunk of Bun.stdin.stream()) {
  const lines = decoder.decode(chunk).split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const req = JSON.parse(line) as { id: number }
      const response = JSON.stringify({ id: req.id, result: { echo: true } })
      process.stdout.write(response + '\n')
    } catch {
      // Ignore parse errors
    }
  }
}
