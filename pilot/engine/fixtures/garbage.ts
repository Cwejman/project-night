// Garbage invocable: writes malformed output to stdout, for protocol error testing.
process.stdout.write('this is not valid json\n')
await new Promise(() => {})
