# OpenLight

![banner](.img/banner.png)

A knowledge system where structure replaces search, relationships are transparent, and knowledge is identity.

## Why

The context window is the foundation of how a completion model integrates with everything else. Today, you can manage your filesystem, define agents, write knowledge into documents — but you cannot navigate or reshape what fills the context. When you have discussed five things and want to focus on one, there is no mechanism. You are left with forgetting, or starting over.

Memory systems aim to help but do not change the relationship. Most retrieve by vector similarity — opaque scores with no transparency about why something was surfaced. Some use knowledge graphs with typed labels, some use temporal ordering or keyword matching. A few combine several strategies. But across the landscape — from RAG pipelines to agent memory frameworks — the relationships between knowledge are either opaque or shallow. No system carries the intelligence of *why* things relate, along *what* dimension, or how that understanding evolves. See [`knowledge/research-map.md`](knowledge/research-map.md) for the full ecosystem grounding.

What changes when context is built from knowledge primitives? Scope replaces forgetting. You navigate what fills the context — narrowing dimensions, widening others. The knowledge system bridges the gap between the model's internal world (where everything is relations between vectors) and the external environment (where everything is files and tools with no relational awareness). Both sides speak structure. This system makes that structure explicit, navigable, and shared.

## What

Five primitives. Everything composes from these.

**Chunks** — units of meaning with optional key/value pairs. **Dimensions** — named phenomena, not rigid categories. **Membership** — binary instance/relates between chunk and dimension (structural, not scored). **Commits** — atomic, lossless history with branching. **Peers** — decoupled knowledge systems that read from each other.

From these: collections, trees, contracts, integrations, and scope-based navigation all emerge without imposed hierarchy. Scope is a set of dimensions — add one to narrow, remove one to widen. Navigation is not a designed paradigm; it is the natural consequence of the structure. An agent bootstraps with a specific scope. A website page is a fixed scope. A browser navigates freely. The system is one thing; the interfaces are many.

Validated by stress-testing across four domains — culture, organization (Sunward, a non-profit), software, and website projection — with 30 agents probing the model's limits. Grounded against 30+ existing systems. The specific combination — named emergent dimensions, binary instance/relates, scope-as-query, commit-based history, general-purpose substrate — does not exist in the current ecosystem. The pieces live in separate research communities that have not been unified.

### How it grows

It starts with a tool. The CLI — `ol` — is a Zig + SQLite binary, and it is the first thing that exists.

Once the tool exists, the first content is the system's own knowledge: its primitives, its design principles, the culture of how one works with it. This is the root — the first real content — and also the proof. If the knowledge system cannot hold its own knowledge transparently, it cannot hold anyone else's.

The CLI's implementation lives alongside this knowledge in the same peer. Not a separate system — different dimensions within the same structure. Scope to design philosophy and you see values. Scope to implementation and you see code-level architecture. Widen and you see how they inform each other.

Then: a browser. A new peer, reading from the root. It inherits the culture and adds its own knowledge — what non-hierarchical browsing means, how scope navigation becomes visual, what each view requires. As the knowledge matures, dimensions of implementation appear — requirements precise enough that an agent can generate code from them. The knowledge is primary; the code is material molded against it.

A Claude plugin follows the same pattern. Its own peer, inheriting culture, adding knowledge about agent lifecycle and integration. Each new tool is a peer, each inherits from the root, each grows implementation from understanding.

Each peer integrates with the outside world through the same primitives. A git file is a chunk with key/value fields referencing a path. A contract chunk tells the agent how to resolve it. No special mechanism — chunks, dimensions, and membership, all the way down.

This plan's peers are more like parents in this cade but the core primitive of peers mean any system can be connected to any other and not limited to one, there are various ideas on how this can be used to compare and merge various knowledge bases... more to come.

## How

The CLI is `ol`. Built in Zig + SQLite — single static binary. Install: `cd openlight && make install`. One write operation (`ol apply`): a declarative JSON mutation that is simultaneously the write format, the commit content, and the diff format. Reads are structural by default — dimensions, connectivity, counts — with content opt-in. `ol init` creates `.openlight/` in the current directory. 10 commands, all implemented. See [`openlight/README.md`](openlight/README.md) for usage and [`knowledge/specification.md`](knowledge/specification.md) for the full spec.

**The path forward:** CLI implementation → system's own knowledge ported into itself → Claude plugin (custom, not built-in memory) → TUI browser (non-hierarchical, scope-based) → deeper integration where the context lifecycle is first-class.

**What is explored but not yet built:** culture-as-root, navigable context, integration contracts, session bubbles as ephemeral peer knowledge bases. **What is visionary:** first-class context lifecycle, the boundary between model and environment dissolving, natural evolution of the system from within. These inform the design but do not drive the immediate steps.

The exploration lives in [`knowledge/`](knowledge/README.md). Inspired by long late night sessions plunging the depths of AI: [the-strange-of-agi](https://github.com/Cwejman/the-strange-of-agi). The subdirectory `knowledge/legacy/` contains a superseded entry system that prematurely attempted to build relational knowledge in markdown files, with Claude hooks for bootstrapping. Especially with the release of Claude Opus 4.6 and a 1M context window, keeping to a few markdown files without frontmatter has worked better.
