#!/usr/bin/env node
// Claude Code statusline — knowledge system + context status.
// Receives session JSON via stdin. Reads .claude/status.json from cwd or project root.
// Output: single compact line, always visible in Claude Code UI.

const fs = require('fs');
const path = require('path');

function findStatusJson() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.claude', 'status.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let session = {};
  try { session = JSON.parse(raw); } catch {}

  let status = null;
  const statusPath = findStatusJson();
  if (statusPath) {
    try { status = JSON.parse(fs.readFileSync(statusPath, 'utf8')); } catch {}
  }

  // Context from stdin — show remaining% with dynamic trend arrow
  const ctxPct = session?.context_window?.remaining_percentage ?? null;
  const ctxRem = ctxPct !== null ? Math.round(ctxPct) : null;
  const prevCtxRem = status?.context?.lastCtxPct ?? null;
  const arrow = ctxRem === null ? '' : prevCtxRem === null ? '' : ctxRem > prevCtxRem ? '↑' : ctxRem < prevCtxRem ? '↓' : '';
  const ctxStr = ctxRem !== null
    ? ctxRem < 20 ? `\x1b[31m${ctxRem}%${arrow}\x1b[0m`
    : ctxRem < 40 ? `\x1b[33m${ctxRem}%${arrow}\x1b[0m`
    : `\x1b[32m${ctxRem}%${arrow}\x1b[0m`
    : '—';

  // Persist ctx trend + model context window size for other scripts
  if (statusPath && status) {
    try {
      const cw = session?.context_window ?? {};
      status.context = { ...(status.context ?? {}), lastCtxPct: ctxRem ?? status.context?.lastCtxPct };
      // Persist full context_window so measure-bootstrap can use actual window size
      if (Object.keys(cw).length) status.context.window = cw;
      if (session?.model) status.session = { ...(status.session ?? {}), model: session.model };
      fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    } catch {}
  }

  // Lossless from status.json
  const lossless = status?.lossless?.status;
  const losslessStr = lossless === 'pass' ? '\x1b[32m✓\x1b[0m'
    : lossless === 'fail' ? `\x1b[31m✗${status.lossless.errors}\x1b[0m`
    : '\x1b[33m?\x1b[0m';

  // Entry count
  const entries = status?.knowledge?.entryCount ?? '—';

  // Risk
  const risk = status?.context?.risk;
  const riskStr = risk === 'low' ? '\x1b[32m▼\x1b[0m'
    : risk === 'high' ? '\x1b[31m▲\x1b[0m'
    : risk === 'medium' ? '\x1b[33m◆\x1b[0m'
    : '';

  // Compactions
  const compact = status?.session?.compactions ?? 0;
  const compactStr = compact > 0 ? ` \x1b[2m⟳${compact}\x1b[0m` : '';

  // Knowledge system indicator (only if status found)
  const l1t = status?.knowledge?.l1Tokens;
  const l2t = status?.knowledge?.l2Tokens;
  const l1p = status?.knowledge?.l1Pct;
  const l2p = status?.knowledge?.l2Pct;
  const bStr = l1t
    ? `\x1b[2m~${Math.round(l1t/1000)}k L1 (${Math.round(l1p)}%) ~${Math.round(l2t/1000)}k L2 (${Math.round(l2p)}%)\x1b[0m`
    : '';
  const ksIndicator = status ? `\x1b[36m◈\x1b[0m ${entries} ${losslessStr} ${bStr}` : '';

  const parts = [
    ksIndicator,
    `rem ${ctxStr}`,
    riskStr,
    compactStr,
  ].filter(Boolean).join('  \x1b[2m│\x1b[0m  ');

  process.stdout.write(parts + '\n');
});
