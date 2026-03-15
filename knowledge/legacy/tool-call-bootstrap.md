---
id: 15
title: Tool Call — bootstrap.js
tags: [tool-call, script, bootstrap, session]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Node.js script that runs at session start and after compaction. Reads all knowledge entries, extracts Layer 1 summaries, and outputs them to stdout for injection into Claude's context. Fail-silent — never blocks a session.

## Layer 2 — Implementation

File path: `/Users/jcwejman/git/@x/night/.claude/bootstrap.js`
Invoked by: `.claude/settings.json` SessionStart hook

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'knowledge', 'entries');

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
    if (fm.title && layer1) summaries.push(`### ${fm.title}\n${layer1}`);
  }
  if (summaries.length === 0) process.exit(0);
  console.log(`## Knowledge System — Active Context (${summaries.length} entries)\n`);
  console.log(`Root: ${ROOT}/knowledge/\n`);
  console.log(summaries.join('\n\n'));
  console.log(`\n> Full entries available at ${ENTRIES_DIR}/<slug>.md`);
} catch (e) {
  process.exit(0);
}
```

### Hook matcher

Matcher `"startup|compact"` is valid — the field is a regex string. Fires on new session (`startup`) and after compaction (`compact`). Does not fire on `resume` or `clear` by design.

Valid source values: `startup`, `resume`, `clear`, `compact`. Empty string `""` or `"*"` matches all four.
