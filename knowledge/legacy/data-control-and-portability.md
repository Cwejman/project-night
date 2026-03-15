---
id: data-control-and-portability
title: Data Control, Time, and Knowledge Portability
tags: [architecture, data-control, portability, federation, future, design]
namespace: knowledge-system
created: 2026-03-08
updated: 2026-03-08
---

## Layer 1

The filesystem approach gives the human full data control: git backups at chosen points in time, no cloud dependency, full ownership. Git is explicitly NOT a first-class system tool — the human controls versioning. Beyond personal control, the portability of the format opens a future capability: connecting someone else's knowledge system to yours and letting an agent infer new wisdom from the intersection. Knowledge federation as a future direction.

## Layer 2

### Data control via filesystem

The current FS-based approach is intentionally human-controlled at the storage layer. The human can:
- Snapshot the knowledge base at any point by committing to git
- Roll back to any previous state
- Inspect, edit, or archive entries directly with standard tools
- Move the entire knowledge base to any machine

This is a feature of the filesystem approach, not a limitation. Cloud-stored, API-dependent knowledge systems give the user less control. The local-first design preserves ownership.

### Git as human-controlled backup

Git is the right backup mechanism — but it is operated by the human, not the system. The system does not commit, push, or version entries. Automating this would introduce dependencies (git state, commit timing, merge conflicts) that add complexity without clear benefit at current scale. Explicitly out of scope for system automation. Left in the hands of the human.

Implication: point-in-time recovery is available through human-managed git history. No need to build internal versioning into the knowledge system itself.

### Knowledge portability and federation (future)

The filesystem format (frontmatter + markdown, one file per entry) is human-readable and tool-agnostic. This makes knowledge systems portable and composable. Future capability:

**Knowledge federation** — take another person's knowledge system (same format, different namespace), connect it alongside your own, and run agents across both. The agent infers relationships, contradictions, and new insights that neither system contains alone. The intersection of two knowledge bases is more than the sum of their parts.

This capability is native to the filesystem approach: merging two directories is trivial. The harder question is namespace collision resolution and cross-system semantic linking — design problems for when federation is actually needed.

### FS and git as interface to the open-source world (Phase 3 consideration)

When knowledge moves to a vector DB, the file system and git don't disappear — they shift role. Files (muscles, plugin code, culture entries) remain in git because git is the interface to the open-source world: shareable, inspectable, forkable. Knowledge leaves git; code does not.

This also surfaces a tension in the markdown phase: when a project repo is shared with collaborators, `.night` entries inside it are subject to merge conflicts. The DB transition resolves this — knowledge moves to a server that isn't part of the repository. Markdown phase is most cleanly used single-user or with careful coordination; shared repos reveal the limitation.

The files-in-git / knowledge-in-DB split is also the answer to "what does open source mean for this system?" — the scaffolding (muscles, plugin) is visible and forkable; knowledge is private by default and lives in the operator's own DB.

### Design values confirmed

- Local-first: yes, permanently
- Human data control: yes, git is the human's instrument for files; DB is the instrument for knowledge
- System git automation: no, out of scope
- Knowledge portability: inherent to the format — no extra work needed
- Federation: future capability, enabled by the format today
