---
id: operational-discoveries-2026-03-12
title: Operational Discoveries — Muscles, Hooks, and the Portability Gap (2026-03-12)
tags: [architecture, muscles, hooks, operations, portability, exploration]
namespace: knowledge-system
created: 2026-03-12
updated: 2026-03-13
---

## Layer 1

Late-session discoveries from the 2026-03-12 architecture session (prompts 22-28). Muscles currently work as .js invoked by Claude Code hooks — a pragmatic current step, though binding muscles to Claude this tightly probably doesn't align with model-agnostic values long-term. Hooks are already global (configured in ~/.claude/settings.json), so muscles already travel across projects. The operational portability gap was identified: culture travels globally via bootstrap, but write/verify/measure capability is pinned to core — global integration is only valuable if there's a knowledge system to write to. Cross-project knowledge access mechanism is not settled (MCP, filesystem teleportation via symlinks, or both). Skills were questioned — "convenience not architecture" — but remain open. Context pressure means heavy routines (verify, purify) can't just run at session end; alternative triggers are needed but not designed.

## Layer 2

### What's concrete (current step)

**Muscles as .js + hooks:** The existing Node.js scripts (verify, purify, bootstrap, etc.) are invoked by Claude Code hooks on defined events (SessionStart, PreToolUse, PostToolUse, etc.). This works now and is how to move forward. Hooks configured globally in `~/.claude/settings.json` run in every project — muscles already travel without any additional infrastructure.

**Permission friction solved by hooks:** When a muscle is called via Bash (e.g., `node .claude/verify.js`), the user is prompted to approve each tool call. Hooks have no such prompt — they're pre-authorized in settings and execute silently. If all muscles are hook-triggered, the system runs under the hood without per-invocation interruptions. This is a practical reason to prefer hooks over ad hoc Bash invocation, beyond just automation.

**Pre-write validation pattern:** A PreToolUse hook on Write can validate an entry before it's committed. If validation fails, exit code 2 blocks the write entirely. This is mechanical enforcement — deterministic, silent, no agent involvement needed. The pattern generalizes: any convention that should never be violated gets a PreToolUse hook.

**The operational portability gap:** Outside the core project, the agent receives culture (identity, cognitive patterns, design rules) via global bootstrap. But it cannot write entries, run verification, or measure anything — it can only observe. Global integration is only valuable if there's a knowledge system to write to. This is the key problem for multi-project operation.

### What's explored but not settled

**Muscles and platform binding:** Hooks are Claude Code-specific. The system's values (model-agnostic, platform-agnostic) suggest muscles shouldn't be permanently bound to one platform's hook system. The current approach is pragmatic — move forward with what works — but the long-term relationship between muscles and platform is an open question. MCP was the earlier assumption for platform-agnostic muscle invocation; that assumption was questioned but not replaced with a definitive alternative.

**Cross-project knowledge access:** Three mechanisms were discussed:
- MCP server for core knowledge (universal, storage-abstracted)
- Filesystem teleportation (read-only symlinks — no infrastructure, works now)
- Hybrid (both, with different roles)
None was chosen. The question is open.

**Skills:** The user expressed skepticism about Claude Code skills as an architectural element. Key question: do skills add capability beyond what hooks + .js provide, or are they just "the Claude native version of MCP" — a convenience layer? Not rejected but not embraced. The preference is platform-agnostic when possible.

**Routine placement requires agent presence awareness:** Running verify or purify at SessionEnd was initially proposed then self-corrected — both as a context pressure problem AND because verify/purify produce results the agent needs to act on. If the agent can't act on the results (context full, session ending), the routine's output is wasted. Heavy routines with agent-actionable output need triggers at points where the agent can respond. No specific trigger solution designed yet — this is an open design problem.

### Source

Session prompts 22-28 from session-prompts-2026-03-12-3837ed0b. This entry captures what emerged in the rapid late-session exchange where operational questions were explored under context pressure. The architectural entries written earlier in the session (evolution-synthesis, system-as-agent-identity, multi-project-architecture, etc.) cover the broader architectural understanding; this entry covers the operational territory that followed.
