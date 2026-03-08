#!/usr/bin/env node
// Verification routine — lossless security check.
// Run at the end of every session during Phase 1 development.
// Exit 0 = all clear. Exit 1 = gaps found.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');

const REQUIRED_FM = ['id', 'title', 'tags', 'namespace', 'created', 'updated'];
const LAYER1_RE = /##\s+Layer 1/;
const LAYER2_RE = /##\s+Layer 2/;

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return fm;
}

function extractLayer1(content) {
  const match = content.match(/##\s+Layer 1[^\n]*\n+([\s\S]*?)(?=\n##\s+Layer 2|\n---\s*$|$)/);
  return match ? match[1].trim() : null;
}

let errors = 0;
let warnings = 0;
const ids = new Map();

console.log('── Verification Routine ─────────────────────────\n');

const files = fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.md')).sort();
console.log(`Checking ${files.length} entries...\n`);

for (const file of files) {
  const slug = file.replace('.md', '');
  const content = fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8');
  const fm = extractFrontmatter(content);
  const fileErrors = [];

  // Frontmatter exists
  if (!fm) {
    fileErrors.push('missing frontmatter');
  } else {
    // Required fields
    for (const field of REQUIRED_FM) {
      if (!fm[field]) fileErrors.push(`missing frontmatter field: ${field}`);
    }
    // Duplicate ID check
    if (fm.id) {
      if (ids.has(fm.id)) {
        fileErrors.push(`duplicate id: ${fm.id} (also in ${ids.get(fm.id)})`);
      } else {
        ids.set(fm.id, slug);
      }
    }
  }

  // Two-layer format
  if (!LAYER1_RE.test(content)) fileErrors.push('missing ## Layer 1 section');
  if (!LAYER2_RE.test(content)) fileErrors.push('missing ## Layer 2 section');

  // Layer 1 has content
  const layer1 = extractLayer1(content);
  if (!layer1 || layer1.length < 10) fileErrors.push('Layer 1 summary is empty or too short');

  if (fileErrors.length > 0) {
    console.log(`✗ ${slug}`);
    fileErrors.forEach(e => console.log(`  · ${e}`));
    errors += fileErrors.length;
  } else {
    console.log(`✓ ${slug}`);
  }
}

console.log('\n── Summary ──────────────────────────────────────');
console.log(`  Entries checked: ${files.length}`);
console.log(`  Errors found:    ${errors}`);
console.log(`  Warnings:        ${warnings}`);

if (errors === 0) {
  console.log('\n✓ All clear — no loss detected.\n');
  process.exit(0);
} else {
  console.log('\n✗ Gaps found — knowledge system is not in a clean state.\n');
  process.exit(1);
}
