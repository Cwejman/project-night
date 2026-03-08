#!/usr/bin/env node
// tmux status bar script — reads status.json, outputs a compact one-liner for tmux status-right.
// Add to ~/.tmux.conf:
//   set -g status-right '#(node /Users/jcwejman/git/@x/night/.claude/tmux-status.sh)'
//   set -g status-interval 2

const fs = require('fs');
const path = require('path');
const STATUS_FILE = path.join(__dirname, 'status.json');

function tryRead() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { return null; }
}

const s = tryRead();
if (!s) { process.stdout.write('◈ offline'); process.exit(0); }

const ll = s.lossless?.status === 'pass' ? '✓' : s.lossless?.status === 'fail' ? `✗${s.lossless.errors}` : '?';
const risk = s.context?.risk === 'low' ? '▼' : s.context?.risk === 'high' ? '▲' : s.context?.risk === 'medium' ? '◆' : '?';
const entries = s.knowledge?.entryCount ?? '?';
const compact = s.session?.compactions > 0 ? ` ⟳${s.session.compactions}` : '';
const pending = s.loss?.pending > 0 ? ` ${s.loss.pending}▲` : '';

// Last tool timings — last 3, compact
const timings = (s.toolTimings ?? []).slice(-3).map(t => {
  const sec = (t.ms / 1000).toFixed(1);
  return `${t.tool}▸${sec}`;
}).join(' ');

const right = timings ? `  ${timings}` : '';
process.stdout.write(`◈ ${entries} ${ll}${pending} ${risk}${compact}${right}`);
