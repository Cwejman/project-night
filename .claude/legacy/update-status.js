#!/usr/bin/env node
// Shared status.json updater. Called by hooks with a patch object via stdin or args.
// Usage: echo '{"lossless":{"status":"pass","errors":0}}' | node update-status.js
// Or:    node update-status.js --verify   (runs verify and patches lossless)
//        node update-status.js --entries  (patches knowledge.entryCount)
//        node update-status.js --compact  (increments compactions, sets risk low)
//        node update-status.js --risk high --note "approaching limit"

const fs = require('fs');
const path = require('path');

// Support session-scoped status files for parallel sessions.
// Set SESSION_ID env var to isolate: SESSION_ID=s2 node update-status.js --init
const sessionSuffix = process.env.SESSION_ID ? `-${process.env.SESSION_ID}` : '';
const STATUS_FILE = path.join(__dirname, `status${sessionSuffix}.json`);
const ENTRIES_DIR = path.join(__dirname, '..', 'knowledge', 'entries');

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); }
  catch { return { session: {}, context: {}, lossless: {}, knowledge: {}, agents: {} }; }
}

function writeStatus(s) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2));
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = target[key] || {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const args = process.argv.slice(2);
const s = readStatus();
const now = new Date().toISOString();

if (args.includes('--init')) {
  s.session = { startTime: now, compactions: s.session?.compactions ?? 0, lastCompact: s.session?.lastCompact ?? null };
  s.context = { risk: 'low', note: '' };
  s.lossless = { lastVerify: s.lossless?.lastVerify ?? null, status: s.lossless?.status ?? 'unknown', errors: s.lossless?.errors ?? 0 };
}

if (args.includes('--compact')) {
  s.session.compactions = (s.session.compactions ?? 0) + 1;
  s.session.lastCompact = now;
  s.context.risk = 'low';
  s.context.note = 'just compacted';
}

if (args.includes('--pre-compact')) {
  s.context.risk = 'high';
  s.context.note = 'compaction imminent';
}

if (args.includes('--verify')) {
  const { execSync } = require('child_process');
  try {
    execSync(`node ${path.join(__dirname, 'verify.js')}`, { stdio: 'pipe' });
    s.lossless = { lastVerify: now, status: 'pass', errors: 0 };
  } catch (e) {
    const errCount = (e.stdout?.toString() ?? '').match(/Errors found:\s+(\d+)/)?.[1] ?? '?';
    s.lossless = { lastVerify: now, status: 'fail', errors: Number(errCount) };
  }
}

if (args.includes('--entries')) {
  try {
    const count = fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.md')).length;
    s.knowledge = s.knowledge ?? {};
    s.knowledge.entryCount = count;
  } catch {}
}

const riskIdx = args.indexOf('--risk');
if (riskIdx !== -1) s.context.risk = args[riskIdx + 1] ?? 'unknown';

const noteIdx = args.indexOf('--note');
if (noteIdx !== -1) s.context.note = args[noteIdx + 1] ?? '';

const lastEntryIdx = args.indexOf('--last-entry');
if (lastEntryIdx !== -1) {
  s.knowledge = s.knowledge ?? {};
  s.knowledge.lastEntry = args[lastEntryIdx + 1];
  s.knowledge.lastIndexRegen = now;
}

// Patch from stdin if piped — only allow known status keys, never hook metadata
const ALLOWED_STDIN_KEYS = ['session', 'context', 'lossless', 'knowledge', 'agents', 'loss', 'toolTimings'];
if (!process.stdin.isTTY) {
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    try {
      const patch = JSON.parse(data);
      const filtered = {};
      for (const k of ALLOWED_STDIN_KEYS) { if (patch[k] !== undefined) filtered[k] = patch[k]; }
      deepMerge(s, filtered);
    } catch {}
    writeStatus(s);
  });
} else {
  writeStatus(s);
}
