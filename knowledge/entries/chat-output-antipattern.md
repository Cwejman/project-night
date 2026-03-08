---
id: chat-output-antipattern
title: Chat Output Antipattern — Write First, Then Acknowledge
tags: [design, lossless, antipattern, agent-behavior, rules]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

Generating knowledge-worthy content in chat before writing it to an entry is loss. The correct pattern is write-first: persist the knowledge to an entry, then optionally acknowledge in chat. Chat output that is never written is permanently lost at compaction.

## Layer 2

### The Antipattern
The agent generates a summary, synthesis, decision, or insight and outputs it to chat. The content exists only in session context. When compaction or session end occurs, it is gone — never persisted. This violates the lossless design intent even if the agent intended to "write it later."

### Why It Happens
- The agent defaults to the conversational affordance — replying in chat feels natural.
- Summarization or synthesis requests look like questions, so the agent answers rather than writes.
- The agent rationalizes: "I'll write it after." But the compaction window may close first.

### The Correct Pattern
1. Receive a request for knowledge-worthy output (summary, synthesis, decision, insight).
2. Write the entry first — before any chat output.
3. Acknowledge in chat only after the write is confirmed (e.g., "Written to `<slug>.md`. 44 entries.").

### Rule
**Chat is not storage.** Any content that belongs in the knowledge system must be written there first. Acknowledgement in chat is optional and always secondary. If in doubt, write.

### Scope
Applies to: summaries, syntheses, design decisions, architectural insights, session state snapshots, and any other knowledge-worthy content.
Does not apply to: clarifying questions, confirmations, conversational responses with no durable knowledge value.
