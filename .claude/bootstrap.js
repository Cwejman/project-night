#!/usr/bin/env node
// Knowledge system bootstrap — runs at SessionStart and after compaction.
// Reads Layer 1 summaries from all knowledge entries and injects them into context.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');
const INDEX_FILE = path.join(ROOT, 'knowledge', 'index.md');

function extractLayer1(content) {
  const match = content.match(/##\s+Layer 1[^\n]*\n+([\s\S]*?)(?=\n##\s+Layer 2|\n---\s*$|$)/);
  return match ? match[1].trim() : null;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) fm[key.trim()] = rest.join(':').trim();
  }
  return fm;
}

try {
  const files = fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.md')).sort();
  const summaries = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8');
    const fm = extractFrontmatter(content);
    const layer1 = extractLayer1(content);
    if (fm.title && layer1) {
      summaries.push(`### ${fm.title}\n${layer1}`);
    }
  }

  if (summaries.length === 0) {
    process.exit(0);
  }

  console.log(`## Knowledge System — Active Context (${summaries.length} entries)\n`);
  console.log(`Root: ${ROOT}/knowledge/\n`);
  console.log(summaries.join('\n\n'));
  console.log(`\n> Full entries available at ${ENTRIES_DIR}/<slug>.md`);
} catch (e) {
  // Fail silently — bootstrap failure must never block a session
  process.exit(0);
}
