# Entities, Siblings, and Collections

How the model handles structured entities. Explored and resolved using instance/relates.

## How It Works

**Entities start as chunks, become dimensions as knowledge accumulates.** A person mentioned once is a chunk on the `people` dimension. A person with 20 associated chunks becomes their own dimension.

**Siblings share a dimension.** Projects are `instance` of `projects`. People are `instance` of `people`. Querying `{projects}` with `instance` filter lists the projects. Cross-cutting queries work naturally: `{project-alpha, people}` → who's on Alpha.

**Instance/relates resolves the core tension.** "Project Alpha IS a project" → `instance`. "This methodology chunk RELATES TO projects" → `relates`. The browser shows instances by default. Relating chunks are available but don't contaminate collection views.

**Key/value pairs handle structured records.** A person chunk has `{name: "Alice", phone: "...", role: "..."}`. A project chunk has `{budget: 200000, start_date: "2024-01"}`. The browser and views render structured fields directly. No parsing needed.

**Tree-like structures emerge.** Instance/relates builds hierarchy without imposing it. A git file reference is `instance` of "git-integration." The git contract is `instance` of "integration-contract." Navigation follows: integration-contract → git-contract → specific file references.

## Validated

Stress-tested across 4 domains (see `agent-stress-test-synthesis.md`). Instance/relates was unanimously identified as essential by all 8 agents. Key/value pairs essential for operational domains. Dimension properties not needed — collection vs topic emerges from instance/relates usage.
