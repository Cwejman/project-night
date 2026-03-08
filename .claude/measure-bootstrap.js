#!/usr/bin/env node
// Measures the token footprint of the bootstrap Layer 1 output.
// Approximates tokens as chars/4 (standard GPT/Claude rule of thumb).
// Shows per-entry cost and total, so you know what bootstrapping costs in context.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');

function extractLayer1(content) {
  const match = content.match(/##\s+Layer 1[^\n]*\n+([\s\S]*?)(?=\n##\s+Layer 2|\n---\s*$|$)/);
  return match ? match[1].trim() : null;
}

function extractLayer2(content) {
  const match = content.match(/##\s+Layer 2[^\n]*\n+([\s\S]*?)(?=\n---\s*$|$)/);
  return match ? match[1].trim() : null;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return fm;
}

const approxTokens = chars => Math.round(chars / 4);

// Read context window size from status.json if available (written by statusline from session JSON)
function readCtxWindow() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'status.json'), 'utf8'));
    const cw = s?.context?.window;
    // context_window may have max_tokens, total_tokens, or we can derive from remaining_percentage + used
    if (cw?.max_tokens) return cw.max_tokens;
    if (cw?.total_tokens) return cw.total_tokens;
  } catch {}
  return 200000; // fallback
}

const ctxWindow = readCtxWindow();
const files = fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.md')).sort();

let l1Chars = 0, l2Chars = 0;
const rows = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8');
  const fm = extractFrontmatter(content);
  const layer1 = extractLayer1(content);
  const layer2 = extractLayer2(content);
  if (!fm.title || !layer1) continue;
  const l1c = layer1.length + fm.title.length + 6;
  const l2c = layer2 ? layer2.length : 0;
  l1Chars += l1c;
  l2Chars += l2c;
  rows.push({ slug: file.replace('.md', ''), title: fm.title, l1c, l2c, l1t: approxTokens(l1c), l2t: approxTokens(l2c) });
}

const headerChars = 60;
l1Chars += headerChars;

const l1Tokens = approxTokens(l1Chars);
const l2Tokens = approxTokens(l2Chars);
const l1Pct = ((l1Tokens / ctxWindow) * 100).toFixed(2);
const l2Pct = ((l2Tokens / ctxWindow) * 100).toFixed(2);

console.log('── Bootstrap Footprint ──────────────────────────\n');
console.log(`Entries measured:  ${rows.length}`);
console.log(`Context window:    ${ctxWindow.toLocaleString()} tokens${ctxWindow === 200000 ? ' (fallback)' : ' (from session)'}`);
console.log(`Layer 1 tokens:    ~${l1Tokens.toLocaleString()} (${l1Pct}% of ctx)  ← loaded into context`);
console.log(`Layer 2 tokens:    ~${l2Tokens.toLocaleString()} (${l2Pct}% of ctx)  ← deep storage only`);
console.log(`Total on disk:     ~${(l1Tokens + l2Tokens).toLocaleString()} tokens\n`);

if (l1Tokens > 10000) console.log('⚠️  L1 exceeds 10k tokens — consider namespace segmentation');
else if (l1Tokens > 5000) console.log('⚠️  L1 approaching 5k tokens — monitor growth');
else console.log('✓  L1 footprint is lean');

console.log('\n── Top 10 Largest L1 Entries ────────────────────\n');
rows.sort((a, b) => b.l1c - a.l1c).slice(0, 10).forEach((r, i) => {
  const bar = '█'.repeat(Math.round(r.l1t / 10)).padEnd(20);
  console.log(`${String(i + 1).padStart(2)}. ${bar} L1~${r.l1t}t L2~${r.l2t}t  ${r.slug}`);
});

// Write to status.json
try {
  const STATUS_FILE = path.join(__dirname, 'status.json');
  const s = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  s.knowledge = s.knowledge ?? {};
  s.knowledge.l1Tokens = l1Tokens;
  s.knowledge.l1Pct = parseFloat(l1Pct);
  s.knowledge.l2Tokens = l2Tokens;
  s.knowledge.l2Pct = parseFloat(l2Pct);
  // keep bootstrapTokens as alias for l1Tokens for statusline compat
  s.knowledge.bootstrapTokens = l1Tokens;
  s.knowledge.bootstrapPct = parseFloat(l1Pct);
  fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2));
  console.log('\n✓ Written to status.json (l1Tokens, l2Tokens, l1Pct, l2Pct)\n');
} catch {}
