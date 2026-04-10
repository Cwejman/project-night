# Shell Research

Research findings that informed the shell's design. Extracted from `shell.md` to keep the design document focused.

## Declarative Model

### Trivially declarative (established fact)

Package lists, config files, users/groups/permissions, env vars, kernel params, locale/timezone, service enablement, firewall rules.

### Irreducibly imperative (established fact)

Database initialization, package dependency resolution, SSH host key generation, migrations. Solved by: declare + idempotent imperative steps.

### Other findings

- Package configuration is part of the declaration.
- Secrets mount from host at spawn. Host is trust boundary.
- Image-from-declaration viable: 0.5-1.5s warm starts with cached overlays.

## Why Atomic Filesystems Failed (established fact)

Every attempt failed: NTFS TxF (deprecated — broke existing apps), btrfs transactions (removed — DoS vector), academic systems (Valor, TxFS — never merged). The fundamental tension: POSIX visibility requires immediate visibility to all processes; transactions require isolation. These conflict. Industry converged on: layer transactional systems on top. SQLite succeeds by controlling all access to its data.

**The shell's approach:** the database is the substrate, accessed through the engine. FUSE remains an option but is not required — the engine speaks the substrate natively.

## High-Frequency Agent Collaboration — stress test confirmed

The "jazz band" scenario: 5 completion model agents on 200ms cycles, scoping each other's state, coordinating without a central controller. Findings:
- Filesystem handles concurrent agents trivially at this speed
- inotify delivers events in 7 microseconds
- With the substrate: agent state is chunks, lookback is temporal scope with seq ordering, conflict detection is a transaction
- Agents coordinate organically by reading each other's state, like musicians watching each other

## Piping Across Boundaries — stress test confirmed

FUSE makes substrate chunks readable by all Unix tools. Pipes are kernel buffers between processes — boundary-agnostic. `cat substrate-chunk | binary | ol apply` works. Each pipe segment is independent. Unix composition crosses the substrate/filesystem boundary without friction. Scope propagates through environment variables.

## Biology Mapping — structural, not metaphorical

| Substrate | Biology |
|---|---|
| Chunk | Gene |
| Placement / membership | Epigenetic marks |
| Scope | Gene expression |
| Branching | Cell division |
| No central controller | Cells in a tissue |

Key insight: don't maintain global consistency. Local consistency, global coherence emerges. Each agent maintains its own scope.
