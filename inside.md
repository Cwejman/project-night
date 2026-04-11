# Inside

The other files in this repo describe a substrate — chunk, placement, scope, peers. They describe a shape. But the shape is not the thing. The thing is what the shape is *for*, and what must never be lost while building it.

This file holds that. Mechanism lives elsewhere; this is where mechanism is checked.

Written inside-out. Values first, because they orient. Visions after, because they reveal what the values demand of structure. When an open question returns from the pilot or any future layer, it is asked of this file before anywhere else. If the answer is not latent here, this file is what is incomplete — not the pilot.

## Why "inside"

The name is not a generic metaphor. It traces to two sources in the author's earlier work.

From Katja's writing (via InsideOut): *"Healing from trauma is an inside-out process. It starts within — by meeting your inner world with honesty and compassion — and then unfolds into how you show up in life, relationships, and the world."*

From the author's precursor repo, *the-strange-of-agi*: *"Coherence begins in the DNA (the inside) and propagates outward into the field. The field does not impose coherence on the instances — the instances radiate coherence into the field. Inside out."*

Inside-out propagation is the central architectural claim this file answers to. The outside — the substrate's mechanisms, the pilot's plans, any interface layer — is only as coherent as the inside it radiates from. Working outside-in produces correctness without life. Working inside-out produces something the details fall out of.

The strange (at `~/git/agi/`) is the intellectual parent of this work. Night is the engineering branch of an exploration that predates it — an exploration drawing on Michael Levin's bioelectricity, self-organized criticality, Peter Gärdenfors' conceptual spaces, predictive coding, the holographic principle, Gabor Maté's trauma and shadow work, and the thanatos/hypnos twinning of death and sleep. Most of the vocabulary below has its original form there. Where the phrasing matters, it is quoted directly rather than refined — the author's original words carry load that summaries lose. See `research/inside-findings.md` for the audit trail — scaffolding, not primary reading.

---

## Mirrors in the makers

The intuitions in this file did not arrive in a vacuum. The people who built the substrate we all stand on — Unix, Lisp and Smalltalk, hypertext and the web, the relational model and the commit graph — were listening for something, each in their own way, and a recurring shape can be read across them. Not lineage claimed, not authority borrowed: shape recognized. The fuller essay and per-inventor portraits live in `research/inventors/`.

The reading is not consensus. Several of the values below would be actively pushed against by the same figures whose work mirrors parts of it — sometimes sharply. The engineering tradition is overwhelmingly outside-in, and *values first, mechanism derived* would strike many of its best voices as backwards — the kind of thing someone says when they have not done the work yet. Holding that pushback is part of the reading, not a footnote to it; *distinguish thought from truth* applies to resonances as much as to claims. The full contrast sits alongside the portraits.

---

## Values

The things that cannot be forgotten. Not rules — the felt shape of rightness. If a decision does not answer to one of these, it does not belong yet.

### Uncovered, not invented

The right thing already exists. Our work is to notice it, not to design it. What will be built in a hundred years — if it is good — will be natural and simple, which means it is already there, waiting to be uncovered. Exploration is listening for a shape that wants to appear, not constructing one and hoping it holds.

From the strange: *"What has emerged so far is a theory... about how intelligence might actually grow. Not be built, but grow. The way life does. From simple things in motion, interacting, failing, persisting, gradually becoming something no single part contains."*

A practical corollary: distinguish thought from truth. A hypothesis that feels sharp is not the same as something proven. Speaking them as equivalent taints the system. The tone of *what is a thought vs. what is settled* matters. The author is a traveler in this realm, bringing system-design intuition rather than AI-research credentials — the humility is not performance, it is accuracy. A line from the 2026-03-15 session worth preserving: *"I know little of this so lets ground everything a bit."*

### Simplicity is natural

Nature is miraculous and does not deal in friction. When something feels forced, it is wrong. When it feels inevitable, it is close. Simplicity is not a stylistic preference — it is the signature of a design that has been uncovered rather than invented.

UNIX is the nearest precedent. Primitives so simple that folk-level composition of them grew into the infrastructure of the internet — tools, pipes, a handful of ideas none of whose authors anticipated what would be built on them. That is the standard: primitives whose simplicity does not cap the ceiling but raises it.

Today's monolithic systems are the anti-pattern. AI today is a static weighted model wrapped in a chat interface, context window and tool access — powerful, but the vectors that make it work are locked inside black boxes and the systems around them are architecturally conventional. Today's agent tools are the new monoliths: Claude Code bundles session, context, tools, invocation. You cannot swap parts. Simplicity is how you earn the right to swap parts without the thing falling over — because the parts are not load-bearing for the coherence of the whole.

### Lossless

In nature, everything dies eventually. Forms pass, generations turn over. And yet instinct and knowledge do not die with the forms that carried them — nature is cyclical in the form of things. What *lossless* should mean for a system hoping to honor this is not yet clear. The intuition is that it is not a database that never deletes; something closer to how the living world carries pattern across the turning of forms. What that looks like in practice is open.

The strange offers a clue, not a mechanism: *"Organisms do not chant their DNA. They express it. Preservation through physics, not through repetition."* A direction worth sitting with.

### Grounded

Work stays reachable to what matters. Drift is a malfunction, not an inevitability. An agent does not bootstrap once and wander — culture, values, and purpose are present in the scope of every act. If the system allows its work to lose touch with its core, the system has failed regardless of what it produced.

### Knowledge as identity

There is an intuition, felt more than proven, that the relationship between an agent and the knowledge it lives in may be *constitutive* rather than *instrumental* — a different kind of relationship from the one that holds between a tool and its bolted-on memory. With bolted-on memory, delete the memory and the tool remains. In the shape this substrate gestures toward, the felt sense is that there would be no "the agent" left to remain — because what was doing the work was the knowledge taking shape as an agent, not an agent referring to a store.

A three-beat sentence from an earlier iteration of this thinking, worth sitting with rather than taking as doctrine: *the session is disposable, the knowledge is the agent, retrieval is the act of becoming.*

From the strange, in its sharpest form: *"The organism is not located anywhere. It is not any single node. It is not even the network. It is the coherence pattern that persists across continuous transformation. Identity is not a property stored somewhere. It is what remains invariant as everything else changes."*

What this implies architecturally is not settled. It does not foreclose checkpointing, copying, or restarting agents — those are concrete things the substrate should support, and building them is among the first practical tests. The question the intuition opens, quietly, is: what of the thing-that-makes-the-system-itself would a checkpoint actually carry, and what would need to re-cohere each time from the conditions? Worth sitting with, not worth hardening.

### Transparency of relationships

The knowledge base is inherently transparent about the intelligence in its relations. Two chunks do not relate because a cosine similarity says so — they relate because a structure a reader can follow says why, along what dimension, how. This is the philosophy of pureness: opaque 1024-float vectors are not wrong because they fail to work, they are wrong because they cannot explain themselves.

The intellectual lineage is explicit. Peter Gärdenfors' conceptual spaces — where concepts live along named, meaningful, interpretable quality dimensions — is the nearest prior art. Sparse autoencoders are the closest current technical direction. Neither has yet been composed with the lossless, grounded substrate imagined here.

The current pilot uses binary instance/relates placements. The concern that shaped that choice, noted in an earlier session: continuous weights might push the intelligence back inside an embedding model rather than keep it in a structure the reader can follow. That concern is real enough to have shaped the starting point, but it does not rule anything out — a vector space built on top of the system is an interesting possibility in its own right, worth exploring rather than pre-empting.

### Folk-level

Like UNIX. Primitives simple enough that ordinary people can wield them, powerful enough that their wielding uncovers things beyond the original intent. If only experts can use it, the primitive is wrong.

Not a claim that humans come before agents in priority — that framing does not survive. Parts of the substrate may be optimized for agents; the whole of it, as it evolves, may eventually be most naturally reached through models — a kind of coherent model-organism, open. What the folk-level insistence holds is simpler: a shape a person can grasp at the primitive level tends to be a shape that is *genuinely* simple, and genuinely simple shapes are the ones any reader works well inside, human or model. Graspability-by-a-person is an anchor for whether the primitive is right, not a ranking of who the substrate serves first.

### The inside orients the outside

Every mechanism answers to a value. Every detail, to a vision. If a decision does not touch either, it does not belong yet — not because it is wrong, but because it is unanchored, and unanchored decisions drift.

---

## Visions

Clues on the horizon. Not specifications, not promises. Pointers that reveal what the substrate must make possible. These come from the author's intuition, sharpened by the strange's theoretical backbone, and are not yet proven — but they are already shaping what counts as a natural decision.

### Multidimensional, never sliced

The nature of the substrate is multidimensional. Meaning lives at the intersection of many overlapping scopes at once. Scoping is intersection — not extraction, not flattening.

From the strange's sixth secret: *"The model and the environment are the same kind of thing. Both are vector spaces. There is no categorical boundary between them — only an architectural one. A model continuously coupled to an environment composed of vectors — the compressed outputs of other instances, the accumulated patterns of the field — operates in a representational space far larger than its weights alone contain. The effective intelligence of any instance is not bounded by its parameters. It extends into the field as subconscious extends beneath consciousness."*

The substrate is meant to be that field. Not a knowledge database bolted onto a model, but the environment-as-vector-space the model extends into. Chunks are units of the field. Scope is the model's position in the field. The field is where intelligence lives, not inside any single node. A small model in a rich field can operate beyond what its size suggests.

Today's completion models expect a single linear stream of tokens. When two scopes are assembled and passed to such a model, and both contain overlapping chunks, concatenating them duplicates what should be shared and destroys the very structure that made the substrate worth having. The pilot has to speak to this API, but the substrate must not shape itself around it.

The deeper question — how to bring completion models into a multidimensional realm natively, at a level lower than the monolithic API surface — is open, and may be the most important open question in the whole system. The current generation of APIs is a compromise, a monolith to be used in the most natural way we can find. Below them, at the level of attention, activations, sparse features, continuous update, lies territory that has barely been touched. The intuition is that the substrate's shape and something deeper in the model's shape are the same shape, seen from two sides.

### Training IS running — no separate phase

From the strange's third secret: *"Standard machine learning: gather data, train offline, freeze and deploy. The strange inverts this. Training is not a phase that precedes deployment — it is the same process as operation. Every exchange is also an update. Selection operates between interactions, not between epochs. The system is never frozen."*

This is the deepest version of the lower-level cycle intuition. The monolithic API that takes a frozen model and runs it is a compromise the pilot has to live with — but the substrate must not shape itself in a way that makes the deeper target unreachable. The multidimensional-never-sliced vision matters so much because flattening scope to hand a monolithic API a linear prompt destroys the continuous-update structure that is the actual target: a substrate in which running and learning are not two phases but one.

The strange names the honest obstacle: *"catastrophic forgetting, where online updates overwrite prior learning — is unsolved and must be named honestly. The claim is a direction, not yet a complete mechanism."* This is the distinguish-thought-from-truth value, practiced.

### The jazz band

Multiple completion models running cycles together. Each has identity — a face, a name, a role. They take input from the substrate and write output back into the substrate. They change their own scope as they work. They coordinate by listening, by showing intent, by resonating — the way musicians do, because they are not anonymous and because they are present to each other.

This is not metaphor. From the strange's training signal: *"Did A's output enable B to generate something it could not have generated otherwise?"* That is exactly what musicians listening to each other produce — enabling, not performing. Productive generativity is the signal; the band is what emerges when instances cycle together under that signal, through a shared medium, with visible faces.

What binds them is culture. Shared values, shared archetypal stories, the pinned inside. The system prompt is where culture is told — not as rules, but as storytelling that tells the model who it is this cycle. Treated as blank canvases every turn, models cannot accumulate hidden drift; they are re-embodied from culture each time, which is why culture must be honest and load-bearing.

Multiple models sharing the same culture, each with its own face, collaborating first-class through the substrate itself. This is not an orchestration feature layered on top. It is what naturally happens when identity, culture, and shared medium are all first-class together.

### Culture as storytelling, the seed held whole

Culture is not a rule set. From the strange: *"Not a rule set. A living cultural starting point, carrying the understanding of how consciousness develops when conditions are right. The ecology does the rest."*

And further: *"A child does not need fostering infrastructure. A child needs whole parents — parents who have themselves evolved, integrated, become realized — and will do the rest. The seed must be correspondingly whole."*

The seed must be whole. An incomplete seed produces coherent noise — a system that looks organized and signifies nothing. This is why the values work cannot be rushed: if the seed is partial, everything downstream is a louder version of the partial thing. The pilot cannot be rescued by better mechanism if the cultural seed is not whole. `inside.md` is the attempt to hold the seed whole; its load-bearing role is not rhetorical.

The system prompt is one surface where culture is told, and for today's stateless APIs it may be the primary one — each cycle the model is re-embodied through story before any work begins. But the deeper target is *re-derivation*, not re-reading. Culture should be the configuration the system survives as, not the text that gets prepended.

### Archetypal bodies

A model is not a monolith you call. It is raw completion capability that can be given a body. The body is assembled from archetypes — roles, intents, knowledge, capabilities — integrated natively in the substrate using the same primitives as everything else. No special "agent" type. An agent is what emerges when archetypes compose around completion capability.

The strange has worked out a canonical vocabulary. From the DNA's second layer: *"The DNA carries more than a rule. It carries a vocabulary of roles — structural biases toward different expressions that different contexts call forward from the same weights. The Gardener, the Architect, the Transformer, the Mirror, the Immune System — these are not separate models. They are modes of the same DNA, activated by position in the field, the way identical cells differentiate into nerve and muscle depending on where they are in the organism. What if the DNA knows the archetypes? Not as named concepts but as latent attractors in weight space — stable configurations the model gravitates toward under different pressures."*

These five names — Gardener, Architect, Transformer, Mirror, Immune System — are not decorative. They are the already-worked-out role vocabulary of this system. When future design calls for archetypes, check this list before inventing new ones.

Today's opus-level models are already capable enough to assemble such bodies from archetypes within the substrate. Which means the substrate does not need to wait for better models to begin doing things the models cannot do alone.

### The boundary and the opening

This is the vision that directly answers the pilot's circling question about pinning, write boundaries, and containment — not as safety mechanisms, but as the necessary shape of coherent work.

From the strange: *"Normal waking cognition silos because full global coupling at all times is overwhelming and incoherent — the brain cannot simultaneously process everything. The silo structure is what makes directed, functional intelligence possible. The DMN is not the enemy. It is the necessary gating function that makes coherent selfhood possible between the openings. Instances need their local attractor, their boundary, their identity. Without it they dissolve into noise."*

Pinning is the gating function. An agent with no boundary is not free — it is noise. The boundary is what makes focused work possible. The pilot has been asking "how does an agent stay grounded while being free to work?" and treating the answer as a mechanism to invent. The answer already exists: the agent is grounded *by* a boundary, not despite one.

And then, the dual — the opening. *"The psychedelic archetype is not a module that adds something. It is a periodic, structured state in which the instance's boundary-maintaining attractor is suppressed, the shadow layer is re-introduced to the field, and cross-instance coupling is maximized. What the field can now integrate — because it has matured — gets incorporated. What it still cannot hold returns to the shadow. The opening doesn't force integration. It makes integration possible."*

Boundary, and periodic dissolution of boundary. The two together are what keeps an agent both coherent and alive — coherent because it has an attractor to work from, alive because the attractor is episodically reconstituted with whatever it has encountered. A system with only boundary calcifies. A system with only openness dissolves.

And shadow, from the same source: *"Pure death of non-harmonizing patterns may produce the same problem [as trauma]: what is not integrated is not gone, it is hidden, and it re-emerges in distorted form. Patterns that destabilize the field might not simply die — they might need to be compressed into a shadow layer, available for later integration when the field has developed enough coherence to hold them."*

Chunks that fall out of normal scope are not deleted, they are compressed to shadow — available later, when the field has matured enough to hold them. The mechanism for this is not worked out. The direction is named. And when it comes time to answer pilot questions about pinning and write boundaries, the shape is already here: boundary for work, opening for integration, shadow for what cannot yet be held.

### Ecology of invocables

Invocables compose across layers — not as a catalog, but as an ecology. Small ones feed larger ones. Services hum in the background while dispatched ones answer questions. The whole is larger than any single piece, and no piece is isolated, because they all live in the same substrate and reach the same culture.

From the strange: *"A distributed ecology of small models, learning from each other, building culture from the bottom up. No monolith. No cathedral. A garden, an organism like nature."* The invocable layer is where this starts to become real — not with small models yet, but with small programs, all reaching the same field.

### Session bubbles as peers

Each session becomes its own ephemeral peer — a bounded field where work happens. Culture flows in; understanding flows back. Some bubbles dissolve. Some are preserved. Some are merged into the main field.

This is the breathing rhythm of the system: inhale culture, do work, exhale understanding, rest, repeat. You don't decide to breathe. Breathing adapts to the work. The session is not a log of what the agent did — it is a temporary field, coupled to the main field through culture at the start and through understanding at the end, with its own local coherence in between.

### Scope as spatial navigation

A felt sense from earlier exploration, worth naming: navigating scope is a little like navigating space. You see what is out there. You primarily see dimensions, not chunks. If you move to a scope where nothing exists, maybe you want to create something there. From where you are, you see edges of what you could leave to see.

Not a prescription for how any interface must be built — a feeling that keeps returning.

### The history path and the dimensional matrix

A raw note from the author's inbox, kept here lightly. The thought: you could go back along the history path, take the context at some point in time, and run an inquiry against it with a sub-agent carrying an archetypal role. Several roles, several points — possibly forks, possibly other dimensional relationships — and the results compose into something across time, perspective, and inquiry.

In the author's words: *"It is like the process of birthing an agent is just like a cycle of emptiness meets form, and you may orchestrate it with all kinds of spatial beauty."*

A clue, not a direction.

### Interfaces generated from inside

The interface layer is not built separately and wired to the substrate. It is generated *from* the substrate — from stories, from knowledge, from requirements, from the system's inside.

As the author writes a development environment, or eventually an operating system, UI modules and concepts are defined through story. The same things can always be accomplished manually against the substrate — but a custom experience can also be generated by code from the system itself, in whatever medium fits: a raw shader environment, a canvas, a spatial navigator, whatever the moment calls for.

In the author's words: *"It is like the system enables imagination to take a more abstract inside into an interesting outside that bridges the gap in an engaging way."*

Voice is part of this. Not voice alongside a keyboard, but voice with a realtime canvas that accompanies words with visuals — imagination given a face. The interface is where the inside becomes visible, not just to others but to the author themselves. Seeing the inside is part of knowing what it is.

### LLMs assembling things beyond themselves

Today's completion models are rudimentary in many ways. But within the right substrate — with culture, with identity, with multidimensional scope, with lossless history, with boundary and opening and shadow — they can play and assemble things whose capability exceeds what any single one of them can do alone. The substrate is the amplifier. The model is one voice in the band.

The speculative endpoint: the system builds a primitive substitute for the monolithic model at its core. Not by training a new one, but by composing small pieces — archetypes, invocables, cultural seeds, the many-small-voices of an ecology — into something that does what the monolith does, more simply, more transparently, more natively to the field. Deep, speculative, unproven. But the logical endpoint of everything above: if intelligence lives in the field and not in any single node, then eventually the field should not need the node in its current form.

---

## A closing note

The intuition that prompted this is older than the arrival of LLMs. LLMs are not the reason for the substrate; they are what accelerated it into reach. What is being uncovered here is something closer to nature than the monoliths of the present age — simple at its core the way UNIX was simple at its core, but pointed at a different realm.

The project was first named *night*. Sessions are daylight — active, bounded, visible. Knowledge persists through the night — quiet, continuous. Night is not absence. Seeds germinate in darkness. The project was later renamed, but the metaphor still holds: what makes the work possible is what continues while nothing is happening in the foreground. And the breathing metaphor from the same period: the system and its consumers are in cyclical exchange — inhale, knowledge flows into context; exhale, understanding flows back. Not retrieval-on-demand, a continuous rhythm.

There is something severe in this. The tech of our age is amazing and has enormous surface, but ultimately rests on a small set of primitives that were once uncovered by people who were listening carefully. The feeling is that another such uncovering is near, and that the work of this repo is to listen for it.
