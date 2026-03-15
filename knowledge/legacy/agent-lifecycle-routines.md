---
id: 41
title: Agent Lifecycle Routines — Hooking Into the Main Agent's Processing
tags: [architecture, lifecycle, routines, hooks, purification, lossless, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1 — Summary

Beyond Claude Code's external hook system, routines can be built into the main agent's own processing lifecycle. As the agent starts to process a prompt, specific checks (loss-checkup, purification, context assessment) are injected at defined lifecycle points. This creates a self-regulating agent that maintains the lossless guarantee as part of its natural operation rather than as an external enforcement mechanism.

## Layer 2 — Full Detail

### The distinction from external hooks

Claude Code hooks (PostToolUse, Stop, SessionStart) are external shell commands — they run outside the agent's reasoning. Lifecycle routines are different: they are part of the agent's own cognitive flow, instructed via CLAUDE.md or knowledge entries, executed as the agent reasons.

### Lifecycle injection points

| Point | When | Routine |
|---|---|---|
| Prompt intake | Before responding to any human message | Run security stability checks: verify integrity, check loss.pending, check prompt is logged, read status.json — every prompt, not just at session end |
| Pre-write | Before creating any knowledge entry | Consult index, check for duplicates |
| Post-write | After any write to knowledge system | Run verify, update status, increment knowledge.entryCount |
| Session close | When wrapping up or logging off | Full purification — archival + semantic, final verify |
| Parallel session start | When a new concurrent session begins | Snapshot status, claim namespace, set session ID |

### Implementation approaches

1. **CLAUDE.md rules**: instruct the agent to run specific checks at lifecycle points. The agent follows these as part of every interaction.
2. **Knowledge entry as protocol**: a `lifecycle-protocol.md` entry the agent reads and follows — making the routine itself a knowledge artifact.
3. **Prompt prefix injection**: UserPromptSubmit hook appends a lightweight status summary so the agent always starts each response with current system state visible.

### Why this matters

External hooks enforce structure but cannot reason. The agent reasoning through a lifecycle routine can make judgment calls — "this prompt has high semantic density, I should write three entries before responding." External hooks cannot do that. Lifecycle routines make the agent itself the lossless enforcer, not just a recipient of external checks.

### Security checks on every prompt — not just at session end

The system security and stability checks (verify, purify, prompt logging) should ideally run on every prompt entry, not only at session close. This makes the lossless guarantee continuous rather than terminal. A prompt that causes a gap is caught before the next prompt compounds it. The lightweight version: check loss.pending and prompt log currency on every intake. The full version: run verify before every response. Cost vs. frequency is the tradeoff to calibrate.

### Open exploration

How much of this can be made automatic vs. instructed? CLAUDE.md is always-on but static. A dynamic lifecycle protocol (read from a knowledge entry at prompt start) could evolve without changing CLAUDE.md. This is a large design space worth dedicated exploration.

### Relationship to existing hooks

Not a replacement — a complement. External hooks handle timing (Stop, PreCompact). Lifecycle routines handle reasoning (should I write this? is this a gap? what's the loss state?). Together they form a complete integrity system.
