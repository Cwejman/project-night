#!/usr/bin/env node
// UserPromptSubmit hook — reads action.json and injects queued actions into Claude's context.

const fs = require('fs');
const path = require('path');
const ACTION_FILE = path.join(__dirname, 'action.json');

try {
  if (!fs.existsSync(ACTION_FILE)) process.exit(0);
  const action = JSON.parse(fs.readFileSync(ACTION_FILE, 'utf8'));
  if (action.consumed) process.exit(0);

  // Mark consumed
  action.consumed = true;
  action.consumedAt = new Date().toISOString();
  fs.writeFileSync(ACTION_FILE, JSON.stringify(action, null, 2));

  // Inject into context via stdout
  const msg = `[QUEUED ACTION — ${action.ts ?? 'now'}]: ${action.action}${action.payload ? ' — ' + action.payload : ''}`;
  process.stdout.write(JSON.stringify({ additionalContext: msg }) + '\n');
} catch { /* fail silent */ }
process.exit(0);
