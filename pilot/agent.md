# The Agent

The claude invocable is the pilot's concrete agent. It runs in the VM, communicates with the engine via protocol, calls the Anthropic API directly (TypeScript SDK, raw API calls). The model is a dispatch argument or `.env` configuration — not hardcoded on the invocable chunk. No framework between the engine protocol and the API.

## Session Types

```
session
  spec: { propagate: true, ordered: true, accepts: ["prompt", "answer", "tool-call", "tool-result", "context"] }
  body (convention, not required): { started: ISO string }

prompt    (placed on agent, instance; placed on session, relates)
answer    (placed on agent, instance; placed on session, relates)
tool-call (placed on agent, instance; placed on session, relates)
  spec: { required: ["invocable"] }
  body also carries: tool_use_id (Anthropic API mapping), input (JSON) — convention for the agent loop
tool-result (placed on agent, instance; placed on session, relates)
  spec: { required: ["invocable"] }
context   (placed on agent, instance; placed on session, relates)
  spec: { ordered: true }
```

Type definitions use `relates` — they stay out of ordered content while remaining resolvable for `accepts`. Content chunks use dual placement: `instance` on the session (with seq) and `instance` on the archetype (for type membership).

Context as a session event means the exact scopes passed to the model are recorded — full traceability of what knowledge informed each response. Context is `ordered: true` without `accepts` — any chunk placed on it IS a scope reference by identity.

## Context, Pinning, and Scope Change

The dispatch's context chunk is the **pinned set** — assembled by the user at dispatch time, immutable from that point. Culture first (seq: 0), knowledge scopes after. The agent cannot modify the dispatch; it was committed before the invocable spawned.

When the agent expands its reading scope mid-dispatch, it writes a `context` event to the session. The host assembles each cycle: dispatch's pinned context first, then the agent's latest additions. The agent grows its view but cannot remove what was pinned. Every addition is checked against the read boundary.

The context events on the session are the trace — what the agent was reading at every turn.

## The Agent Cycle

1. Receives dispatch ID and engine endpoint. Calls `scope` via protocol to read the dispatch (session, context, prompt, read-boundary, write-boundary).
2. Calls `apply` to place prompt and context on session (dual placement, traceability)
3. Each cycle: assembles knowledge layer (pinned + additions) + session layer (tool chain), calls Anthropic API
4. On `tool_use`: calls `dispatch` via protocol — the engine creates a tool-call dispatch, executes it, returns the result. The agent records tool-call/tool-result on session.
5. On scope change: writes a context event to session via `apply` — the engine validates that referenced scopes are within the read boundary.
6. On `end_turn`: writes answer on session via `apply`, then exits.

Every step is a chunk on the session. The read tile shows the full trace in order.

## Context Assembly

Two layers per API call:

- **Knowledge layer** — the agent's current scope serialized for the model. Re-assembled from the substrate each cycle. Culture first, then project knowledge, then active scopes.
- **Session layer** — the current dispatch's tool chain only. The chain grows within a dispatch (API requires it). Previous dispatches are visible through scope in the knowledge layer, not as native message history.

Whether knowledge goes in the system prompt (cacheable) or is manufactured as message history (more natural continuity) needs testing. The pilot should test both.

**Session chunk → API message mapping:**

| Chunk type | Maps to |
|---|---|
| `prompt` | `{ role: "user", content: body.text }` |
| `answer` | `{ role: "assistant", content: [{ type: "text", text: body.text }] }` |
| `tool-call` | `{ type: "tool_use", id: body.tool_use_id, name: body.tool, input: body.input }` — grouped into assistant message |
| `tool-result` | `{ type: "tool_result", tool_use_id: body.tool_use_id, content: body.text }` — grouped into user message |
| `context` | Not sent — traceability metadata |

## Tool Specs — Substrate to Anthropic API Mapping

Tool definitions for the Anthropic API call are derived from the substrate. No manual sync between what the system can do and what the model is told.

**Generating tool definitions.** The engine reads the invocable chunks within the dispatch's read boundary and generates a tool definition for each:

1. Invocable `name` → tool `name`
2. Invocable `body.text` → tool `description`
3. For each type in the invocable's `accepts`: read the type chunk's `spec.required` → `input_schema.required`. Read the type chunk's body for property schemas (types, enums, descriptions) → `input_schema.properties`.

Example — a filesystem invocable:

```
filesystem (instance of invocable)
  spec: { propagate: true, accepts: ["fs-command"] }
  body: { text: "Read and write files", executable: "./invocables/filesystem" }

fs-command (relates to filesystem)
  spec: { required: ["operation", "path"] }
  body: { text: "A filesystem operation", schema: {
    operation: { type: "string", enum: ["read", "write", "edit", "glob", "grep"] },
    path: { type: "string", description: "File or directory path" }
  }}
```

Generates:

```json
{
  "name": "filesystem",
  "description": "Read and write files",
  "input_schema": {
    "type": "object",
    "properties": {
      "operation": { "type": "string", "enum": ["read", "write", "edit", "glob", "grep"] },
      "path": { "type": "string", "description": "File or directory path" }
    },
    "required": ["operation", "path"]
  }
}
```

**Translating model responses back to dispatches.** When the model returns a `tool_use`, the engine creates the dispatch:

1. Model returns `{ id: "toolu_abc", name: "filesystem", input: { operation: "read", path: "/foo" } }`
2. Engine looks up the `filesystem` invocable, reads its `accepts` → `["fs-command"]`
3. Engine creates one `apply()`: fs-command chunk with `body: { operation: "read", path: "/foo" }` placed on a new dispatch chunk (instance of `filesystem` and `dispatch`), with boundaries computed from intersection of parent + invocable intrinsic
4. Engine spawns the invocable in the VM, returns result when done

**Tool-call session tracing.** The agent records the tool call on the session with a tool-call chunk. `required: ["invocable"]` — where `invocable` is the dispatch chunk ID (the specific invocation). The dispatch IS the record of what happened — the input is on it as typed chunks, the invocable's writes are traced to it. The `tool_use_id` from the Anthropic API is stored in body by convention for message mapping, not as a structural requirement.

## Sub-agents

A sub-agent is a dispatch — its dispatch IS its working scope (`ordered: true`). Parent session records tool-call (spawn) → tool-result (answer). Scope into the child dispatch for internal trace. Depth limit: 3.

## Culture

Not a special type. A chunk the user creates with values, instructions, identity. Placed first in the context ordering so the model reads it first. Culture is a convention, not a mechanism.

## Knowledge Serialization

The engine assembles the knowledge layer for the agent by reading scope contents and serializing them for the model. Starting format for the pilot:

```
# [scope-name]

[body.text of scope chunk]

## [child-name] (instance)

[body.text or structured fields]

## [child-name] (relates)

[body.text or structured fields]
```

Markdown with scope headers as section breaks. Culture scope first (anchors model interpretation). Instances before relates within each scope. Chunks without `body.text` render as key-value. Nested scopes indent or use sub-headers. The exact format will be refined through testing — this is the starting point, not the final form.
