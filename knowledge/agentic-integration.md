# Agentic Integration

How the knowledge system relates to agents and other consumers.

## Settled — The Metaphors and Identity

**The breathing metaphor.** Inhale: knowledge flows into context. Exhale: understanding flows back. Not retrieval-on-demand — a continuous rhythm. Breathing adapts to activity.

**The night metaphor.** Sessions are daylight. Knowledge persists through the night — quiet, continuous. Night is not absence. Seeds germinate in darkness.

**The identity equation.** The knowledge system IS the agent. The LLM is interchangeable machinery. Delete the knowledge and nothing exists. (The genome metaphor: knowledge is the genome, the LLM is the cellular machinery.)

**The three-beat sentence:**
> The session is disposable. The knowledge is the agent. Retrieval is the act of becoming.

**The architectural test.** Delete memory from Mem0 → you still have ChatGPT. Delete knowledge from this system → nothing exists.

## Settled — The Agent's Role

The agent/human is the actor. The DB is just information. Specifically:

- **How does knowledge get in?** The agent writes it, in the way the human orchestrates.
- **How do dimensions come into existence?** The agent or human creates them. The system is just information; the agent is the actor.
- **How are references resolved?** The agent reads the integration contract and executes the resolution.
- **Caching, staleness, re-weighting?** Agent concerns. The DB stores what was put in. There is an idea here though to provide a separate service to help the consumers aginst loss by providing caching of all refernces in the system. Not db concern but could be written for first class support, but to the agent/human, but also to the browser.
- **What role do embeddings play?** They help the agent suggest weights, discover dimensions, navigate. They're agent tooling, not a DB primitive.

The knowledge system provides the structure. The agent provides the intelligence. Culture (itself a peer knowledge system) informs the agent on how to work with the system.

## Settled — Initial Approach

Deliberate writes. Claude's existing capability suffices. No systemic routine cycles needed to start.

## Hypothesis — Session Bubbles (Later)

When full integration exists, each session could be its own peer knowledge base — a bubble. Culture and routines define what flows in. Some content (raw prompts, tool call logs) stays in the session's peer, separate from the main system.

## Hypothesis — The Deeper Cycle (Deferred)

Completion-model integration directly with the knowledge system. Every turn writes. The model's cycle is natively tied to the knowledge system.

Not an immediate goal. Open questions: granularity, what gets written, who decides, cost.

A separate system design being explored on the side: cyclical completion-model integration where the input is a query, the output is the next query plus whatever it produces. Some outputs are tool calls whose results go toward integration chunks. Other agents can observe. This informs the broader integration contract but is not the immediate focus.
