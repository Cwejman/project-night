---
id: verbatim-prompt-storage
title: Verbatim Prompt Storage — No Deviation From Source
tags: [rules, lossless, prompts, session-log, agent-behavior]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-12
---

## Layer 1

Session prompt entries must contain the exact text the human wrote or spoke — never summarized, paraphrased, or cleaned up. Prompts are the lossless record of what was actually said. Any deviation from the original text is information loss. The human's exact phrasing carries meaning that a summary destroys. For voice transcriptions, use the exact transcribed text. Never substitute summaries like "[Voice prompt — extended] Topics: ..." for the actual words.

## Layer 2

### Origin

During the 2026-03-12 session, a session-prompts entry was written that summarized a voice prompt instead of transcribing it verbatim. The human corrected this: "knowledge should be lossless but most importantly prompt should be, it may not deviate from what has been written or voiced."

### The rule

When writing `session-prompts-*` entries:
- Copy the exact text from chat for typed prompts (including typos, unconventional phrasing)
- Copy the exact transcription for voice prompts
- L1 summary may describe topics — but L2 raw prompts must be verbatim
- Never clean up, rephrase, or condense the human's words

### Why this matters beyond convention

The lossless design intent applies most critically to prompts. An entry about a concept can be re-derived from the prompt that produced it. But if the prompt itself is altered, the original intent is unrecoverable. Prompts are the primary source; entries are derived artifacts. The primary source must be pristine.
