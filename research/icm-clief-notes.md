# ICM / Clief Notes — Jake Van Clief

Interpretable Context Methodology. Folder structure as agentic architecture. Formalized in an arXiv paper ([2603.16021](https://arxiv.org/abs/2603.16021)) with David McDermott, March 2026. Community of ~30k on Skool. Canonical repo: [RinDig/Interpreted-Context-Methdology](https://github.com/RinDig/Interpreted-Context-Methdology).

## Core Claim

Folder structure is sufficient orchestration for sequential AI workflows. The coordination problem that frameworks solve — passing correct context to correct agents at correct times — can be achieved by putting the right files in the right folders with the right naming conventions.

## Five-Layer Context Hierarchy

Each layer answers a more specific question. The agent reads downward and stops when it has enough.

```
Layer 0: CLAUDE.md           — "Where am I?"            (~800 tokens, always loaded)
Layer 1: CONTEXT.md          — "Where do I go?"          (~300 tokens, workspace routing)
Layer 2: Stage CONTEXT.md    — "What do I do?"           (~200-500 tokens, stage contract)
Layer 3: Reference material  — "What rules apply?"       (stable constraints — "the factory")
Layer 4: Working artifacts   — "What am I working with?" (per-run input/output — "the product")
```

Layer 2 is the control point. Its Inputs table declares which files and which *sections* the agent should load, with precision and purpose. Total context per stage: 2,000-8,000 tokens.

## Stage Contract Format (CONTEXT.md)

Each stage's CONTEXT.md follows a fixed shape:

- **Inputs** table: Source | File/Location | Section/Scope | Why
- **Process**: numbered steps, concrete enough that two agents produce structurally similar output
- **Checkpoints** (optional, creative stages): After Step | Agent Presents | Human Decides
- **Audit** (optional): Check | Pass Condition
- **Outputs** table: Artifact | Location | Format

Target: under 80 lines. Reference files under 200 lines.

## Canonical Directory Structure

```
workspace-name/
  CLAUDE.md              # Layer 0: folder map, routing table, naming conventions
  CONTEXT.md             # Layer 1: task routing table -> stages
  setup/
    questionnaire.md     # Onboarding config — asked once, baked in permanently
  skills/                # Bundled domain knowledge as markdown
  brand-vault/           # Stable reference material (voice, identity, design system)
    CONTEXT.md
  stages/
    01-name/
      CONTEXT.md         # Layer 2: the stage contract
      output/            # Layer 4: stage artifacts go here
      references/        # Layer 3: stage-specific reference material
    02-name/
      CONTEXT.md
      output/
      references/
  shared/                # Cross-stage reference files
```

## Key Design Rules

- **CONTEXT.md = routing, not content.** If you're writing more than one sentence of description, it belongs in a separate file.
- **Selective section routing.** Input tables specify which sections of a file to load, not just the file.
- **One-way cross-references.** Stage 03 can reference Stage 02's output. Stage 02 never references Stage 03. Prevents N-squared reference growth.
- **Canonical sources.** Every piece of information has one home. Other files point there.
- **Output-as-input handoff.** Stage N writes to `stages/0N/output/`. Stage N+1 reads from there. Human can edit between stages.
- **Review gates.** Every stage stops after writing output. No automatic progression.
- **Docs over outputs.** Reference docs are authoritative. Previous stage outputs are artifacts, not templates.
- **Token discipline.** "Every token of irrelevant context is a token of diluted attention." Explicit "Do NOT Load" columns in CLAUDE.md.
- **Naming:** `lowercase-with-hyphens`, zero-padded stage prefixes (`01-`, `02-`), output artifacts as `[topic-slug]-[artifact-type].md`, placeholders as `{{SCREAMING_SNAKE_CASE}}`.

## Factory vs. Product

**Factory (Layer 3):** Configured once during workspace setup, stable across every run. Design systems, voice rules, conventions, brand identity. Constraints the model internalizes. The workspace IS the factory.

**Product (Layer 4):** Per-run artifacts. Previous stage outputs, user-provided source material. Changes every pipeline execution. Inputs the model transforms.

The paper argues these require different cognitive modes: Layer 3 = "be constrained by this," Layer 4 = "transform this." Separating them structurally gives clearer signals than merging in undifferentiated prompts.

## Theoretical Lineage

- Unix pipelines (McIlroy 1978): small programs, text interface, output-as-input
- Parnas information hiding (1972): modules decompose around what they hide
- Feldman's Make (1979): files are both artifacts AND coordination mechanism
- Multi-pass compilation: transforms through intermediate representations
- "Lost in the middle" (Liu et al.): LLMs degrade when relevant info is buried in long contexts

## What It Validates

**Context is power.** The entire system is an operationalization of the insight that controlling what fills the context window is the primary lever for agent quality. 30k people getting results from this alone.

**Convention carries insight.** Most users can't articulate why ICM works. The folder conventions carry the deep insight (scoped context, token discipline, separation of concerns) to people who don't hold the theory. The right conventions transport understanding without requiring it.

**Token discipline as architecture.** Treating context limits as a design constraint that produces better work, not a problem to engineer around.

## Where It Breaks

**No intersections.** Content at the intersection of multiple scopes (a connection that IS the relationship between two things) has no filesystem equivalent. Hierarchy only, not relational.

**No real agent agnosticism.** The system depends on Claude Code's CLAUDE.md auto-loading. No adapter pattern, no provider interface. "The files are plain text" is the entire abstraction.

**No dynamic scoping.** Folder structure is fixed at workspace creation. No live "add a scope to narrow, remove to widen."

**No versioning.** Stages overwrite output files. No commits, no branches, no time travel, no lossless history.

**Sequential only.** Not for real-time multi-agent collaboration, complex branching, or high-concurrency.

**No traceability.** If stage 3 output has a problem, no way to trace it to the specific instruction or reference that caused it.

## Relevance to OpenLight

ICM validates the "context is power" thesis with today's tools. The substrate and shell address the problems ICM can't touch — relational placement, typed enforcement, dynamic scoping, versioned history, real agent composability. But ICM proves that convention over infrastructure gets surprisingly far for sequential content production with human review gates. The lesson isn't to copy the conventions — it's that the right constraints, even unenforced ones, produce structured behavior from agents. And that people don't need to understand the theory to benefit from it.
