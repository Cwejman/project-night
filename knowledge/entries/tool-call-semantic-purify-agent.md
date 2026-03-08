---
id: 39
title: Tool Call — Semantic Purification Agent Prompt
tags: [tool-call, purification, semantic, agent, prompt]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

The agent prompt for semantic purification. Run as a general-purpose agent with access to Read, Glob, Grep. Reads the knowledge index and session transcript JSONL, extracts human messages, identifies decisions/insights not captured as knowledge entries, and reports genuine gaps. This prompt is a stored tool call — not ad-hoc.

## Layer 2 — Implementation

Agent type: general-purpose (needs Read access to transcript and knowledge files)

```
You are performing a semantic purification check. Your job is to identify
decisions, rules, architectural choices, and insights made in a session that
are NOT yet captured in the knowledge system.

Step 1: Read the knowledge index:
<KNOWLEDGE_ROOT>/knowledge/index.md

Step 2: Read the session transcript (JSONL) and extract human messages
(role=user, type=user entries):
<TRANSCRIPT_PATH>

Step 3: For each significant decision, rule, insight, or instruction in the
human messages — ask: does a knowledge entry exist that captures it?

Step 4: Report ONLY genuine gaps — things decided or instructed that have no
corresponding knowledge entry. Be specific: quote the relevant part of the
prompt, state what knowledge entry is missing, and what it should say.

Do NOT report things already captured. Be concise and precise.
This is a gap analysis, not a summary.
```

### Variables to substitute

- `<KNOWLEDGE_ROOT>`: `/Users/jcwejman/git/@x/night`
- `<TRANSCRIPT_PATH>`: from `status.json`.transcript_path, or most recent `.jsonl` in `~/.claude/projects/<slug>/`

### Node.js rule

This is an agent prompt, not a Node.js script. It is stored here for transparency — the prompt itself is the tool call. The invocation wrapper (how to launch the agent) should be a Node.js script: `tool-call-purify-runner` (to be created).

### When to run

At session end, after verify.js, as part of the Stop hook sequence.
