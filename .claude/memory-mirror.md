# Claude Project Memory — Mirror

Transparent copy of `~/.claude/projects/.../memory/MEMORY.md`.
If this file drifts from the actual memory, the memory file is authoritative.

---

## Bootstrap Instructions

On session start, read all `.md` files in `knowledge/` (not subdirectories, not `knowledge/legacy/`). These contain the current state of the project — requirements, model, exploration, session history.

Do NOT read `knowledge/legacy/` unless explicitly instructed. It contains the old L1/L2 entry system (68 entries, superseded by the current exploration).

## Repo State

- `.claude/` — hooks cleared. Only `statusline.js` is active (context % display). All other scripts are in `.claude/legacy/`.
- No code has been written for the knowledge system itself. The project is in ideation/design phase.
- The old bootstrap hook system (L1 injection at session start) is no longer active.

## About the Author

System design intuition, exploring AI from the intersection of software design and the nature of reality. Not an AI/ML researcher — brings strong design instincts and values grounding intuition with practical understanding. Prefers exploration before building, requirements before code. Corrects the agent when it presents hypotheses as settled or rushes to solutions. The tone of what is a thought vs what is settled truth matters.

## Working Style

- Do not present hypotheses as settled. Always distinguish explored from proven.
- NEVER write files to the Claude memory directory (`~/.claude/` memory dir). All knowledge lives in the repo. The only file in the memory dir is this MEMORY.md with bootstrap instructions — it points to the repo, it does not store knowledge.
- Work only with files in the repository. The repo is the source of truth.
- Files written to the repo should reflect current understanding. Outdated content taints the system.
- When writing files, the author will often correct and refine — this is the exploration process, not rejection.
