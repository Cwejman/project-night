---
id: verbatim-prompt-storage
title: Verbatim Prompt Storage — No Deviation From Source
tags: [rules, lossless, prompts, session-log, agent-behavior]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-13
---

## Layer 1

Session prompt entries must contain the exact text the human wrote or spoke — never summarized, paraphrased, or cleaned up. Prompts are the lossless record of what was actually said. Any deviation from the original text is information loss. The human's exact phrasing carries meaning that a summary destroys. For voice transcriptions, use the exact transcribed text. Never substitute summaries like "[Voice prompt — extended] Topics: ..." for the actual words. As of 2026-03-13: agent responses are also stored verbatim in L2 alongside human prompts. L1 remains a concise topic summary; L2 carries the full dialog (both sides). This prevents the loss that occurs when a session dies before conclusions are written as entries.

## Layer 2

### Origin

During the 2026-03-12 session, a session-prompts entry was written that summarized a voice prompt instead of transcribing it verbatim. The human corrected this: "knowledge should be lossless but most importantly prompt should be, it may not deviate from what has been written or voiced."

### The rule

When writing `session-prompts-*` entries:
- Copy the exact text from chat for typed prompts (including typos, unconventional phrasing)
- Copy the exact transcription for voice prompts
- L1 summary may describe topics — but L2 raw prompts must be verbatim
- Never clean up, rephrase, or condense the human's words

### Agent responses in L2 (convention established 2026-03-13)

Session-prompts entries now carry both sides of the dialog in L2. The format is exchange-based: each human prompt followed by the agent's response. This was motivated by the 2026-03-12 session's context death — the agent's late-session responses (containing synthesized conclusions about muscles, hooks, and operational portability) were lost because only human prompts had been logged. The JSONL transcript has both sides; the session-prompts entry should too.

The agent responses are pure L2 — never loaded into bootstrap context, only consulted when reconstructing what happened in a session. The cost is disk space (free); the value is insurance against context death and session boundary loss.

### Why this matters beyond convention

The lossless design intent applies most critically to prompts. An entry about a concept can be re-derived from the prompt that produced it. But if the prompt itself is altered, the original intent is unrecoverable. Prompts are the primary source; entries are derived artifacts. The primary source must be pristine.
