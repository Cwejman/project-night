#!/usr/bin/env node
// Scaffolds a new knowledge entry with a timestamp-based ID (collision-safe for parallel sessions).
// Usage: node .claude/new-entry.js <slug> <title> [namespace] [tags]
// Example: node .claude/new-entry.js my-concept "My Concept" knowledge-system "design,architecture"

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');

const [,, slug, title, namespace = 'knowledge-system', tags = ''] = process.argv;

if (!slug || !title) {
  console.error('Usage: node .claude/new-entry.js <slug> <title> [namespace] [tags]');
  process.exit(1);
}

const targetFile = path.join(ENTRIES_DIR, `${slug}.md`);
if (fs.existsSync(targetFile)) {
  console.error(`✗ Entry already exists: ${slug}.md`);
  process.exit(1);
}

// Timestamp-based ID: YYYYMMDD-HHmmss-mmm — unique across parallel sessions
const now = new Date();
const id = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  '-',
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
  String(now.getSeconds()).padStart(2, '0'),
  '-',
  String(now.getMilliseconds()).padStart(3, '0'),
].join('');

const date = now.toISOString().slice(0, 10);
const tagStr = tags ? `[${tags.split(',').map(t => t.trim()).join(', ')}]` : '[]';

const content = `---
id: ${id}
title: ${title}
tags: ${tagStr}
namespace: ${namespace}
created: ${date}
updated: ${date}
---

## Layer 1 — Summary



## Layer 2 — Full Detail

`;

fs.writeFileSync(targetFile, content);
console.log(`✓ Created: knowledge/entries/${slug}.md (id: ${id})`);
console.log(`  Run: node .claude/generate-index.js after writing content`);
