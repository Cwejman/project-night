#!/usr/bin/env node
// Knowledge System — TUI Status Panel
// Run in a separate terminal: node .claude/tui.js
// Watches .claude/status.json and re-renders on change.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Support session-scoped status files. Run: SESSION_ID=s2 node .claude/tui.js
const sessionSuffix = process.env.SESSION_ID ? `-${process.env.SESSION_ID}` : '';
const STATUS_FILE = path.join(__dirname, `status${sessionSuffix}.json`);
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgDark: '\x1b[40m',
  clear: '\x1b[2J\x1b[H',
};

function color(str, ...codes) {
  return codes.join('') + str + C.reset;
}

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); }
  catch { return null; }
}

function countEntries() {
  try { return fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.md')).length; }
  catch { return '?'; }
}

function formatTime(iso) {
  if (!iso) return color('never', C.dim);
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString();
}

function losslessColor(status) {
  if (status === 'pass') return color('● PASS', C.green, C.bold);
  if (status === 'fail') return color('● FAIL', C.red, C.bold);
  return color('● UNKNOWN', C.yellow, C.bold);
}

function contextRisk(risk) {
  if (risk === 'low') return color('▼ LOW', C.green);
  if (risk === 'medium') return color('◆ MEDIUM', C.yellow);
  if (risk === 'high') return color('▲ HIGH', C.red, C.bold);
  return color('? UNKNOWN', C.dim);
}

function box(title, lines, width = 52) {
  const top = `╭─ ${color(title, C.cyan, C.bold)} ${'─'.repeat(Math.max(0, width - title.length - 4))}╮`;
  const bottom = `╰${'─'.repeat(width)}╯`;
  const body = lines.map(l => {
    const clean = l.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = Math.max(0, width - 2 - clean.length);
    return `│ ${l}${' '.repeat(pad)} │`;
  });
  return [top, ...body, bottom].join('\n');
}

const COMPACT = process.argv.includes('--compact');

function timingStrip(timings) {
  if (!timings || timings.length === 0) return '';
  return timings.slice(-4).map(t => {
    const sec = (t.ms / 1000).toFixed(1);
    const c = t.ms < 1000 ? C.green : t.ms < 5000 ? C.yellow : C.red;
    return color(`${t.tool}▸${sec}`, c);
  }).join(' ');
}

function renderCompact(s, entryCount, now) {
  const lossless = s?.lossless?.status;
  const ll = lossless === 'pass' ? color('✓', C.green)
    : lossless === 'fail' ? color(`✗${s.lossless.errors}`, C.red)
    : color('?', C.yellow);
  const risk = s?.context?.risk;
  const rk = risk === 'low' ? color('▼', C.green)
    : risk === 'high' ? color('▲', C.red, C.bold)
    : risk === 'medium' ? color('◆', C.yellow)
    : color('?', C.dim);
  const compact = s?.session?.compactions ?? 0;
  const compStr = compact > 0 ? color(` ⟳${compact}`, C.dim) : '';
  const pending = s?.loss?.pending > 0 ? color(` ${s.loss.pending}▲`, C.red) : '';
  const agents = (s?.agents?.active ?? []).length;
  const agStr = agents > 0 ? color(` ◎${agents}`, C.yellow) : '';
  const timings = timingStrip(s?.toolTimings);

  process.stdout.write(C.clear);
  process.stdout.write(
    `${color('◈', C.cyan)} ${color(String(entryCount), C.bold)} ${ll}${pending}  ${rk}${compStr}${agStr}  ${timings}  ${color(now, C.dim)}\n`
  );
}

function render() {
  const s = readStatus();
  const entryCount = countEntries();
  const now = new Date().toLocaleTimeString();

  if (COMPACT) { renderCompact(s, entryCount, now); return; }

  process.stdout.write(C.clear);

  console.log(color('\n  ◈ Knowledge System', C.bold, C.white) + color('  status panel  ' + now, C.dim));
  console.log();

  if (!s) {
    console.log(color('  status.json not found — system not initialised', C.red));
    return;
  }

  // Lossless
  console.log(box('LOSSLESS', [
    `  Status     ${losslessColor(s.lossless?.status ?? 'unknown')}`,
    `  Errors     ${s.lossless?.errors > 0 ? color(s.lossless.errors, C.red) : color('0', C.green)}`,
    `  Last check ${formatTime(s.lossless?.lastVerify)}`,
  ]));
  console.log();

  // Knowledge
  const l1t = s.knowledge?.l1Tokens, l1p = s.knowledge?.l1Pct;
  const l2t = s.knowledge?.l2Tokens, l2p = s.knowledge?.l2Pct;
  const l1Str = l1t ? `~${Math.round(l1t/1000)}k (${Math.round(l1p)}%)` : color('—', C.dim);
  const l2Str = l2t ? `~${Math.round(l2t/1000)}k (${Math.round(l2p)}%)` : color('—', C.dim);
  console.log(box('KNOWLEDGE', [
    `  Entries    ${color(String(entryCount), C.cyan, C.bold)}`,
    `  L1 (ctx)   ${color(l1Str, C.green)}`,
    `  L2 (disk)  ${color(l2Str, C.dim)}`,
    `  Last added ${s.knowledge?.lastEntry ? color(s.knowledge.lastEntry, C.white) : color('—', C.dim)}`,
    `  Index regen ${formatTime(s.knowledge?.lastIndexRegen)}`,
  ]));
  console.log();

  // Context
  console.log(box('CONTEXT', [
    `  Risk       ${contextRisk(s.context?.risk ?? 'unknown')}`,
    `  Compactions ${color(String(s.session?.compactions ?? 0), C.white)}`,
    `  Session    ${formatTime(s.session?.startTime)}`,
    s.context?.note ? `  Note       ${color(s.context.note, C.dim)}` : `  Note       ${color('—', C.dim)}`,
  ]));
  console.log();

  // Agents
  const active = s.agents?.active ?? [];
  const pending = s.loss?.pending ?? 0;
  console.log(box('AGENTS', [
    `  Active     ${active.length > 0 ? color(active.join(', '), C.yellow) : color('none', C.dim)}`,
    `  Last write ${formatTime(s.agents?.lastWrite)}`,
    `  Blocked    ${s.agents?.blockedWrites > 0 ? color(String(s.agents.blockedWrites), C.red) : color('0', C.green)}`,
    `  Pending    ${pending > 0 ? color(`${pending} not yet written`, C.red) : color('0 — clean', C.green)}`,
  ]));
  console.log();

  // Tool timings
  const timings = s.toolTimings ?? [];
  if (timings.length > 0) {
    const rows = timings.slice(-6).reverse().map(t => {
      const sec = (t.ms / 1000).toFixed(2) + 's';
      const c = t.ms < 1000 ? C.green : t.ms < 5000 ? C.yellow : C.red;
      const ago = formatTime(t.ts);
      return `  ${color(t.tool, C.bold)}  ${color(sec.padStart(6), c)}  ${color(ago, C.dim)}`;
    });
    console.log(box('TOOL TIMINGS', rows));
  }

  console.log(color('\n  watching for changes…', C.dim));
}

render();

fs.watch(STATUS_FILE, { persistent: true }, () => {
  setTimeout(render, 50); // debounce
});

// Refresh clock every 10s
setInterval(render, 10000);
