# Landscape Research — 2026

What the ecosystem of knowledge/memory systems looks like, what they teach, and what makes this project's approach unique. Research conducted April 2026.

## The Systems

### Zep / Graphiti — Temporal Knowledge Graph

Bi-temporal model with four timestamps per edge: creation, expiration, validity start, invalidation. Old facts invalidated rather than deleted.

**Why it exists:** RAG treats facts as isolated embeddings. "I used to like Adidas, now I prefer Nike" — similarity search returns the Adidas fact because it doesn't know it's superseded. Facts need temporal validity, not just existence.

**Key insight:** System time (when the system learned) and event time (when it was true) are different questions. Both are needed for audit/compliance.

### MAGMA — Multi-Graph Agentic Memory (January 2026)

Four orthogonal graphs over the same event nodes: temporal, causal, semantic, entity. Query intent determines which graph to traverse.

**Why it exists:** "Why did X happen?" and "When did X happen?" need fundamentally different retrieval. Semantic similarity entangles these.

**Key insight:** Different query intents need different structural views of the same data.

### Mem0 — Production Agent Memory

Four composable scopes (user, agent, run, org). Three memory types (episodic, semantic, procedural). Optimized for production latency.

**Why it exists:** Memory bleed between agents in production. Without scope isolation, a billing agent retrieves tech support memories.

**Key insight:** Scopes must compose, not just isolate. Rigid scoping is too inflexible for real queries.

### Cognee — Knowledge Engine

Universal "DataPoint" primitive. Triple-store hybrid. "Memify" step prunes stale nodes and strengthens frequent connections.

**Why it exists:** Knowledge graphs degrade without maintenance. Stale nodes accumulate. Re-indexing takes days and breaks.

**Key insight:** Memory is not static storage — it's an evolving structure that must adapt.

### LightRAG — Fast RAG Pipeline

Entities + relations extracted by LLM, each with textual profiles + embeddings. Dual-level retrieval: entity-specific vs thematic. ~100x cheaper than Microsoft GraphRAG.

**Why it exists:** GraphRAG proved graph structure improves retrieval but is catastrophically expensive (610K tokens for community detection).

**Key insight:** Specific-entity queries and thematic queries need different retrieval strategies.

### Letta / MemGPT — OS-Like Memory Hierarchy

Memory as tiers: core (in-context), recall (history), archival (indexed). The agent manages its own memory promotion/demotion.

**Why it exists:** Fixed context windows. Old conversations lost, documents that exceed the window can't be analyzed.

**Key insight:** Context pollution is worse than missing context. Too much irrelevant information actively degrades performance.

## Cross-Cutting Findings

| Finding | Discovered by |
|---------|--------------|
| Facts need temporal validity, not just existence | Zep |
| System time and event time are different questions | Zep |
| Query intent must route to different structural views | MAGMA |
| Scope isolation prevents memory bleed between agents | Mem0 |
| Knowledge graphs degrade without active maintenance | Cognee |
| Context pollution is worse than missing context | MemGPT |

## What's Unique About This Project

**No system in the landscape combines version control with knowledge structure.** Atomic commits, branching, and DAG history come from git's lineage, not from AI/ML research. This is a unique design space.

**No system uses set-intersection scoping.** Every system uses entity-relation triplets with vector embeddings as primary retrieval. The dimensional/scoping model — where navigation is set intersection over placements — is not found elsewhere.

**Structure as retrieval.** All other systems use embeddings as primary or co-primary retrieval. This project's scope operation is purely structural — no cosine similarity, no vector search.

**Reader-determined meaning.** Other systems bake meaning at write time (LLM-generated entity profiles, relation summaries). This project leaves meaning in the content. The structure tells the reader where to look; the reader discovers what it means.

## The Triplets vs Scoping Question

The exploration tested whether entity-relation triplets (the dominant paradigm) or dimensional scoping (this project's model) is the right primitive. 18 agents across three rounds of exploration.

**Findings:**
- Three agents designing from scratch all converged on directed relationships (graph primitives)
- Three scenario tests all found the same gaps in the pure dimensional model (no direction, no entity identity, no traversal)
- One critical reviewer challenged the test scenarios as biased toward graph-native domains

**Resolution:** The false binary was rejected. The converged design uses one primitive (chunk) where connections are chunks placed on multiple scopes — preserving set-intersection scoping while enabling traversal through the placement graph. Direction was identified as needed but may emerge from scope context rather than requiring explicit structural direction.

## What Others Have That This Project Addresses Differently

| Capability | Ecosystem approach | This project |
|---|---|---|
| Entity identity | Graph nodes with properties | Chunks with text + spec + kv as identity points |
| Relationships | Typed, directed edges | Connecting chunks at scope intersections |
| Temporal ordering | Timestamps or temporal graphs | Seq on placement, enforced by spec |
| History | Append-only logs or CRUD | Atomic commits with branching (git model) |
| Retrieval | Vector embeddings + graph traversal | Set intersection over placements + FTS |
| Type system | Application-layer schemas | Archetype specs enforced by substrate |
| Scope isolation | Application-layer access control | Peers (separate databases, read-only mount) |
