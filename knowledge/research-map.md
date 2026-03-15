# Research Map — 2026-03-15

Grounding research performed during the exploration session. Organized by relevance to the relational knowledge system being explored.

## Directly Relevant

### SAE-Based Interpretable Embeddings
- **"Interpretable Embeddings with Sparse Autoencoders"** (arxiv 2512.10092, Dec 2025) — uses SAE features for retrieval, outperforms dense embeddings for property-based queries. Named dimensions, weighted activations per chunk. Code: github.com/nickjiang2378/interp_embed
- **SAErch.ai / "Disentangling Dense Embeddings"** (arxiv 2408.00657) — trained SAEs on OpenAI embeddings, discovered "feature families" (hierarchical clusters), enables steerable semantic search. Code: github.com/Christine8888/saerch
- **CL-SR: Concept-Level Sparse Retrieval** (arxiv 2506.00041, EMNLP 2025) — SAE features as inverted-index units for retrieval
- **Anthropic Monosemanticity** — foundational work, tens of millions of interpretable features from Claude 3 Sonnet
- **Goodfire** — commercial SAE product, open-source SAEs for Llama models, feature search and steering API
- **SAELens** (github.com/decoderesearch/SAELens) — main library for training SAEs
- **Neuronpedia** (neuronpedia.org) — 50M+ features with labels, searchable

### Conceptual Spaces (Gardenfors)
- Theory: concepts as regions in spaces with meaningful named dimensions
- Implementation: github.com/lbechberger/ConceptualSpaces (Python, research-grade, last updated 2022)
- Gap: nobody has connected this to modern embeddings or knowledge retrieval

### xMemory — Beyond RAG for Agent Memory
- arxiv 2602.02007 (Feb 2026)
- Four-level hierarchy: messages → episodes → semantics → themes
- Sparsity-semantics objective drives self-organization
- Top-down retrieval (opposite of RAG's bottom-up)
- Core argument: RAG is for heterogeneous corpora, agent memory is a bounded correlated stream
- Code: github.com/HU-xiaobai/xMemory

### Graphiti/Zep — Temporal Knowledge Graph
- Bi-temporal model: when it happened + when the system learned it
- Old facts never deleted, marked with validity windows
- Combines semantic + BM25 + graph traversal for retrieval
- Automatic ontology building
- 94.8% on Deep Memory Retrieval benchmark

## Alternative Query Paradigms

### HippoRAG (NeurIPS 2024)
- Modeled after hippocampal indexing theory
- Personalized PageRank from query entities on a knowledge graph
- Multi-hop traversal in one step, 10-20x cheaper than iterative approaches
- arxiv 2405.14831

### RAPTOR (ICLR 2024)
- Bottom-up tree: embed chunks → cluster → summarize → repeat
- Retrieval at any abstraction level
- +20% accuracy on QuALITY benchmark with GPT-4
- arxiv 2401.18059

### Prompt-RAG
- No embeddings — LLM reads structured table of contents, picks what's relevant
- Outperformed vector RAG on Korean medicine domain
- arxiv 2401.11246

### Self-RAG (ICLR 2024, oral)
- Model emits reflection tokens: should I retrieve? Is this relevant? Is my answer supported?
- No separate retrieval pipeline — generation and retrieval evaluation are unified
- arxiv 2310.11511

### CRAG (Corrective RAG)
- Retrieval evaluator gates between use/discard/decompose
- Decompose-then-recompose: surgically extract useful fragments from documents
- arxiv 2401.15884

### GraphRAG (Microsoft)
- Hierarchical community detection on knowledge graphs
- Community summaries for global questions (what are the main themes across the corpus?)
- Three search modes: global, local, DRIFT (hybrid)

## Memory-Augmented Neural Networks

### Neural Turing Machines
- Controller emits learned query parameters (key vector, key strength, shift)
- Read = content-based attention + location-based shift
- Write = erase + add, gated by write weighting
- Everything differentiable, trains end-to-end

### Differentiable Neural Computers
- Extends NTMs with temporal link matrix (read in write order)
- Usage-based allocation with free gates
- Differentiable analog of OS memory management

### Titans (Google, Jan 2025)
- Neural long-term memory module (MLP that updates its own weights at test time)
- Surprise-gated: unexpected inputs are memorized more strongly
- Scales to 2M+ context
- arxiv 2501.00663

## Retrieval in the Forward Pass

### RETRO (DeepMind)
- Retrieves from 2T token database DURING forward pass
- Chunked cross-attention interleaved with standard transformer blocks
- 25x fewer parameters than GPT-3, comparable performance
- arxiv 2112.04426

### Memorizing Transformers (Google)
- One attention layer extended with kNN lookup over external memory
- Memory grows by appending key-value pairs after each forward pass
- Scales to 262K tokens

## Multi-Relational Embeddings

### TransE / TransR / RotatE / ComplEx
- Learn vector representations for entities AND relationships
- Score functions: translation (TransE), rotation (RotatE), complex multiplication (ComplEx)
- Designed for entity-relation-entity triples — not general knowledge chunks
- Relationship vectors are learned but NOT interpretable
- RotatE captures all four: symmetry, antisymmetry, inversion, composition

## Vector Symbolic Architectures
- Encode relationships as vector operations (binding = circular convolution, bundling = addition)
- Torchhd library: production-ready, 8 VSA models, PyTorch-based
- Elegant algebra but dimensions are random/uninterpretable
- Capacity: ~5-10 bindings per 10,000-dim vector before degradation

## Existing Agent Memory Systems

### Letta/MemGPT
- OS-inspired: core memory (RAM, always in context) + archival (disk, vector search) + recall (conversation history)
- Agent decides what to store/retrieve via tool calls
- Write path exists (unlike RAG)
- Core memory blocks are editable BY the agent

### Mem0
- Extraction + update pipeline
- User-level (persistent) + session-level (task-specific) memory
- Priority scoring + decay mechanisms
- Graph variant (Mem0g) stores as directed labeled graphs

### A-MEM (NeurIPS 2025)
- Zettelkasten-inspired self-organizing memory
- Each memory: raw content + keywords + tags + context + embedding + links
- Adding new memory triggers re-contextualization of existing memories

## Vector DB Mechanics (Qdrant)

- Point = id + vector + payload (JSON)
- HNSW index for approximate nearest neighbor search
- Filtering: must/should/must_not boolean logic on payload fields
- Payload indexes: keyword, integer, float, bool, geo, datetime, text, uuid
- Named vectors: multiple vector types per point
- Sparse vectors: inverted index, good for keyword matching
- Hybrid search: prefetch from dense + sparse, fuse with RRF
- Not append-only: upsert, delete, payload-only updates
- No native versioning — application layer concern
- Multi-tenancy via payload partitioning (recommended) or separate shards/collections

## Chunking Strategies (RAG)

- Recursive character splitting: current practical default, 69% accuracy in Feb 2026 benchmark
- Semantic chunking: expensive (one embedding per sentence), produces tiny fragments, 54% accuracy
- Document-structure-aware: 87% accuracy when source documents are well-structured
- Practical defaults: 256-512 tokens, 10-20% overlap
- Coherence across boundaries: parent document retrieval, contextual retrieval (Anthropic), late chunking

## Hybrid Search
- BM25 (keyword) + dense (semantic) combined via Reciprocal Rank Fusion
- Boosts retrieval accuracy 20-30% over either alone
- Cross-encoder reranking for precision after initial recall
- Anthropic's contextual retrieval: contextual embeddings + BM25 + reranking reduces failures by 67%
