# Integrations and Atomic History

## Atomic History — The Commit Model (Settled)

- Every change is a commit. HEAD is always browsable.
- Any historical state is reconstructable by replaying commits.
- **Branching is a hard requirement.** Run agents on branches, review, merge to main. Exact mechanics open.
- Time navigation in the browser/CLI — open for later. As the system grows and archetypal agents govern it (reverse prompting, reviewing, enforcing against views), the time depth becomes valuable.

## Integrations — Built From Existing Primitives

### No New Primitives Needed

A reference is just a chunk with key/value fields. The fields contain whatever parameters the integration contract needs to execute resolution. The chunk doesn't need to declare what type of integration it is — the contract defines the expected parameters, and the chunk provides them.

### How It Works

**A reference chunk** has key/value pairs with the parameters for resolution (e.g., a file path, an API endpoint, coordinates into an external system). Its text content describes what it is in human/agent-readable form. It has dimensional weights like any chunk.

**Multiple chunks per reference:** When knowledge accumulates around an external reference (API description, implementation notes, test strategy, bugs), the reference becomes a dimension. The reference chunk is `instance` (1.0) on that dimension. Describing chunks `relate`.

**Integration contracts** are themselves knowledge in the system. An integration contract is a chunk that is an `instance` of an "integration-contract" dimension. Its body contains what an agent needs to execute the resolution — the tool call pattern, expected parameters, how to interpret results. Agents read the contract, understand how to resolve references that match it.

**Integration types as collections.** All git references are `instance` of a "git-integration" dimension. The contract for git resolution is also `instance` of "integration-contract." Tree-like structures emerge:

```
integration-contract (dimension)
  └── git-contract (instance) — how to resolve git references
  └── image-contract (instance) — how to resolve image references

git-integration (dimension)
  └── src/storage/index.ts (instance) — reference chunk with resolution parameters
  └── src/scope/index.ts (instance) — another reference
  └── "how git integration works" (relates) — describing chunk
```

**Peer connection decouples.** The integration aspect (contracts, drivers) can be its own peer knowledge system. The consuming system reads it but doesn't mutate it.

### What The DB Stores vs What The Agent Manages

**The DB stores:** chunks, weights, commits. It doesn't know what "git" means. It just holds chunks with fields and weights on dimensions.

**The agent manages:** resolving references (using contracts), caching for lossy mediums, detecting staleness, re-ingesting when external content changes. These are agent tooling concerns.

**Staleness:** When external content is ahead of the last commit where weights were set, that's an agent concern. The DB knows: these weights were set at this commit. Whether the external world has moved on is for the agent to check and act on.

### The Browser's Relationship to Integrations

The browser depends on the knowledge structure. For each integration type, the browser has its own UI implementation — it takes the payload from the chunk's key/value fields and knows how to present it (render an image, show file contents, display API response). Views and view testing/enforcing are the contracts between the browser and the structure. If the structure changes, the browser may break — but that's visible and manageable through view enforcement.

### Broad Scope of Integrations

The pattern (reference chunk + contract + driver) is intentionally general:

- **Git files** — atomic commits align naturally with the knowledge system's commit model.
- **Filesystem (non-git)** — the driver must handle snapshotting since the source doesn't have commits.
- **Images/media** — hosted externally or by the driver. The reference chunk holds the resolution parameters.
- **REST APIs** — a path is a path. A REST endpoint is similar to a file path but with a payload.
- **Streams (further out)** — live audio, video. Agents cycle through the buffer. Both live and history available. Large series — different scale than text chunks.
- **Cyclical agent output (explored on the side)** — when completion models are cyclically integrated, their output is a buffer. Some outputs are tool calls whose results go toward integration chunks. The input is a query; the output is the next query plus whatever it produces. Not the immediate focus but informs the contract's generality.

### What's Still Open

- **Browser recognition of references** — probably just convention (look for specific key/value patterns). The integration contract can define what fields to expect.
- **Large series** (audio, video, streams) — different scale. The commit chain mixing text mutations with media frames needs thought. Further out.
- **Branching mechanics** with integrations — straightforward conceptually, mechanics TBD.
