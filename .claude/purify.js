#!/usr/bin/env node
// Purification routine — like bootstrap but outward.
// Bootstrap: loads knowledge INTO context.
// Purify:    checks what in the session transcript has NOT been persisted OUT to knowledge.
//
// Reads the session JSONL transcript, extracts all human messages,
// compares against stored session-prompts entries, reports any unlogged prompts.
// Run: node .claude/purify.js
// Or:  node .claude/purify.js --write   (auto-appends new prompts to today's session-prompts entry)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STATUS_FILE = path.join(__dirname, 'status.json');
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { return null; }
}

function getTranscriptPath() {
  const s = readStatus();
  if (s?.transcript_path) return s.transcript_path;
  // Fallback: find most recent transcript in projects dir
  const projectsDir = path.join(process.env.HOME, '.claude', 'projects');
  const slug = '-Users-jcwejman-git--x-night';
  const dir = path.join(projectsDir, slug);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    .map(f => ({ f, mt: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mt - a.mt);
  return files.length > 0 ? path.join(dir, files[0].f) : null;
}

function extractHumanPrompts(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const prompts = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Human messages: type=user, message.role=user, content is string or array
      if (entry.type === 'user' && entry.message?.role === 'user') {
        const content = entry.message.content;
        const text = typeof content === 'string' ? content
          : Array.isArray(content) ? content.filter(c => c.type === 'text').map(c => c.text).join(' ')
          : null;
        if (text && text.trim() && !text.startsWith('[QUEUED ACTION')) {
          prompts.push({ text: text.trim(), ts: entry.timestamp ?? null });
        }
      }
    } catch {}
  }
  return prompts;
}

function getStoredPrompts() {
  const stored = new Set();
  const files = fs.readdirSync(ENTRIES_DIR).filter(f => f.startsWith('session-prompts'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8');
    // Extract quoted prompt texts from Layer 2
    const matches = content.match(/"([^"]{20,})"/g) ?? [];
    for (const m of matches) stored.add(m.slice(1, -1).trim().toLowerCase().slice(0, 60));
  }
  return stored;
}

const WRITE_MODE = process.argv.includes('--write');
const transcriptPath = getTranscriptPath();

console.log('── Purification Routine ─────────────────────────\n');

if (!transcriptPath) {
  console.log('✗ No transcript found. Run from project directory or ensure status.json has transcript_path.');
  process.exit(1);
}

console.log(`Transcript: ${path.basename(transcriptPath)}`);
const prompts = extractHumanPrompts(transcriptPath);
console.log(`Human prompts found: ${prompts.length}`);

const stored = getStoredPrompts();
const unlogged = prompts.filter(p => {
  const key = p.text.toLowerCase().slice(0, 60);
  return !stored.has(key);
});

console.log(`Already stored:      ${prompts.length - unlogged.length}`);
console.log(`Unlogged:            ${unlogged.length}`);

if (unlogged.length === 0) {
  console.log('\n✓ All prompts accounted for — no loss.\n');
  process.exit(0);
}

console.log('\n── Unlogged Prompts ─────────────────────────────\n');
unlogged.forEach((p, i) => {
  console.log(`${i + 1}. "${p.text.slice(0, 120)}${p.text.length > 120 ? '…' : ''}"`);
  if (p.ts) console.log(`   ${new Date(p.ts).toLocaleTimeString()}`);
  console.log();
});

if (WRITE_MODE) {
  // Find today's session-prompts entry and append
  const today = new Date().toISOString().slice(0, 10);
  const targetFile = path.join(ENTRIES_DIR, `session-prompts-${today}.md`);
  if (fs.existsSync(targetFile)) {
    const nextNum = (fs.readFileSync(targetFile, 'utf8').match(/^\d+\./gm) ?? []).length + 1;
    const appendText = unlogged.map((p, i) =>
      `\n${nextNum + i}. "${p.text.replace(/"/g, "'")}"`
    ).join('\n');
    fs.appendFileSync(targetFile, appendText + '\n');
    console.log(`✓ Appended ${unlogged.length} prompts to session-prompts-${today}.md\n`);
  } else {
    console.log(`✗ No session-prompts-${today}.md found. Create it first.\n`);
  }
} else {
  console.log('Run with --write to auto-append unlogged prompts to today\'s session-prompts entry.\n');
}
