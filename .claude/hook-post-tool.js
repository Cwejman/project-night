#!/usr/bin/env node
// PostToolUse hook — captures tool name + duration, appends to status.json toolTimings ring buffer.

const fs = require('fs');
const path = require('path');
const STATUS_FILE = path.join(__dirname, 'status.json');

const TOOL_SYMBOLS = {
  Write: 'W', Edit: 'E', Read: 'R', Glob: 'G',
  Grep: 'S', Bash: 'B', Agent: 'A', Task: 'T',
};

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const toolName = input.tool_name ?? input.tool ?? 'Unknown';
    const ms = input.duration_ms ?? null;
    if (!ms) process.exit(0);

    let symbol = TOOL_SYMBOLS[toolName] ?? toolName[0]?.toUpperCase() ?? '?';
    if (toolName === 'Bash') {
      const cmd = input.tool_input?.command ?? '';
      if (cmd.includes('verify.js')) symbol = 'V';
      else if (cmd.includes('generate-index.js')) symbol = 'I';
      else if (cmd.includes('update-status.js')) symbol = 'U';
    }

    const s = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    const timings = s.toolTimings ?? [];
    timings.push({ tool: symbol, ms, ts: new Date().toISOString() });
    if (timings.length > 8) timings.splice(0, timings.length - 8);
    s.toolTimings = timings;

    if (['W', 'E'].includes(symbol)) {
      s.agents = s.agents ?? {};
      s.agents.lastWrite = new Date().toISOString();
    }

    fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2));
  } catch { /* fail silent */ }
  process.exit(0);
});
