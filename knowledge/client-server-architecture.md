# Client-Server Architecture — Unsettled

What is the deployment model for OpenLight? This question surfaced during implementation when we realized `active_branch` was stored in the database — making it server state when it should be client state. That detail exposed the larger question: what is a client and what is a server in this system?

## What the implementation assumes today

The CLI (`ol`) talks directly to a SQLite file. There is no network layer. No auth. No multi-user. The "server" is a file on disk. This is fine as a starting point, but it silently bakes in assumptions.

## The question

Three models, each with different implications:

### 1. Local-first (git model)

You have a full copy of the database. You work offline. Sync is a separate operation — push, pull, merge. The CLI talks to a local file. A "remote" is another copy you reconcile with.

- **Client state**: active branch, working config — local files
- **Server state**: the commit DAG, branches (as pointers), chunks, memberships — in the DB
- **Sync**: explicit (push/pull). Merge conflicts are possible
- **Auth**: only matters at the remote. Local is yours
- **Offline**: full capability
- **Implication**: the current SQLite-file approach IS the local model. A remote would be another service you sync with

### 2. Client-server

The database lives on a server. The CLI is a thin client that talks over a protocol (HTTP, gRPC, WebSocket). No local copy of the data. Every operation is a network request.

- **Client state**: active branch, auth token — local config
- **Server state**: everything else
- **Sync**: not needed — server is always authoritative
- **Auth**: required. Server must authenticate clients, authorize per-branch
- **Offline**: no capability (or degraded)
- **Branch protection**: server-side rules (main is read-only, require review, etc.)
- **Implication**: need to design a protocol, a server process, auth, permissions

### 3. Hybrid

Local SQLite for working. Server for sharing and real-time queries. Like git but with the ability to query the remote directly for read operations without cloning.

- Local writes go to the local DB
- Reads can be local or remote
- Sync pushes local commits to the server
- Server provides a query API for agents that don't need a full local clone
- **Implication**: most complex. Two query paths. Conflict resolution for writes

## What's already clear

Regardless of model, some things are settled:

- **Active branch is client state.** It does not belong in the database. Whether the client is talking to a file or a server, "which branch am I on" is the client's concern. Different clients can be on different branches simultaneously.

- **The commit DAG is the source of truth.** Branches are pointers into it. This is true whether the DAG lives in a local file or on a server.

- **The CLI is a consumer, not the system.** The knowledge graph exists independently of how you access it. The CLI is one interface. An agent SDK would be another. A browser UI another. The protocol question is about how those interfaces reach the data.

## What's not clear

- Is OpenLight primarily a local tool (like a personal knowledge graph) or a shared system (like a team's knowledge base)?
- If shared, does the server need to be an "OpenLight server" (understands the data model, enforces rules) or just a "SQLite server" (dumb storage, client does the logic)?
- What does sync look like? Is it git-style (explicit push/pull with merge) or real-time (CRDT, operational transform)?
- Where does the agent live? Does an AI agent talk to the local CLI, to the server directly, or to both?

## What's been done

**Active branch moved out of the database.** Implemented. Branch is now client-side state — resolved from `--branch` flag > `OPENLIGHT_BRANCH` env > `.openlight/config.json` > default `main`. The `meta` table was removed. The DB is purely a data store with no client-session state. `ol branch switch` writes to `config.json`.

## What's next

Protocol, auth, server — future work that depends on how the system will be used. That understanding should come from the use cases (agentic integration, browser story, views) before being locked into architecture.
