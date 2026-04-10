# Agent Research — April 2026

Research into agent architecture for the pilot: how to build the agent host, what tools are needed, how Claude Code works under the hood.

## Claude Code Architecture

Claude Code's agency is NOT model fine-tuning. It is:

- **A system prompt** — extensive instructions shaping behavior, tool usage, safety rules, conventions. This is the primary "agency" mechanism.
- **A simple while loop** — think → act → observe → repeat. Single-threaded. No complex orchestration.
- **Real tool implementations** — the model's power comes from what it can DO.
- **Context management** — automatic compaction, persistent memory, subagent isolation.
- **Permission/safety layers** — sandboxing, permission classification, hook-based interception.

## Anthropic API Tool Call Format

Proprietary format, NOT MCP. Clean and structured.

**Request — tool definitions:**
```json
{
  "name": "get_weather",
  "description": "Get current weather",
  "input_schema": {
    "type": "object",
    "properties": { "location": { "type": "string" } },
    "required": ["location"]
  }
}
```

**Response — tool call:**
```json
{
  "stop_reason": "tool_use",
  "content": [
    { "type": "text", "text": "Let me check." },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "get_weather",
      "input": { "location": "San Francisco, CA" }
    }
  ]
}
```

**Sending result back (in user message):**
```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "68F, partly cloudy"
    }
  ]
}
```

- `stop_reason: "tool_use"` signals the model wants tools executed
- Multiple `tool_use` blocks in one response = parallel tool calls
- All results go in a single user message
- Error results: `is_error: true` on the tool_result
- No `"role": "tool"` — results are always inside `"role": "user"` messages

**MCP bridge:** MCP uses `inputSchema` (camelCase), Anthropic uses `input_schema` (snake_case). MCP uses `arguments`, Anthropic uses `input`. Minor field renaming to bridge. Anthropic also has a beta MCP connector for server-side bridging.

## Claude Code — Complete Tool Reference

### File Operations
- **Read** — read file contents. Params: `file_path`, `offset`, `limit`, `pages` (PDF). Returns cat -n format. Supports images, PDFs, notebooks.
- **Write** — create/overwrite file. Params: `file_path`, `content`. Enforces read-before-write.
- **Edit** — exact string replacement. Params: `file_path`, `old_string`, `new_string`, `replace_all`. Requires prior Read.
- **Glob** — file pattern matching. Params: `pattern`, `path`. Returns paths sorted by mtime.
- **Grep** — content search (ripgrep). Params: `pattern`, `path`, `output_mode`, `glob`, `type`, context flags, `multiline`, `head_limit`, `offset`.

### Execution
- **Bash** — execute shell commands. Params: `command`, `description`, `timeout` (max 600s), `run_in_background`. Returns stdout/stderr.
- **BashOutput** — retrieve output from background shells.
- **KillShell** — terminate a background shell.

### Web
- **WebSearch** — web search. Params: `query`, `allowed_domains`, `blocked_domains`. Returns results with URLs and snippets.
- **WebFetch** — fetch URL, convert to markdown, process with fast model. Params: `url`, `prompt` (what to extract). 15-min cache.

### Agent / Sub-agents
- **Agent** — launch autonomous sub-agent with its own context window.
  - Params: `prompt`, `description`, `subagent_type` (Explore/Plan/general-purpose/custom), `run_in_background`, `model`, `resume`
  - Sub-agent gets its own context window (completely separate from parent)
  - Gets a system prompt (built-in or from `.claude/agents/*.md`)
  - Cannot spawn further sub-agents (no nesting)
  - Up to ~7 parallel
  - Returns final text report to parent
  - Built-in types: Explore (read-only, haiku), Plan (read-only), general-purpose (all tools)

### Task Management
- **TodoWrite** — structured task lists. Items have `content`, `status` (pending/in_progress/completed), `activeForm`.

### Planning
- **ExitPlanMode** — exit planning mode with implementation plan.

### User Interaction
- **AskUserQuestion** — structured multiple-choice questions to user.

### Tool Discovery
- **ToolSearch** — fetch schemas for deferred/lazy-loaded tools. MCP tools and rarely-used tools load on demand.

### Skills
- **Skill** — execute named skills/slash commands from `.claude/skills/`.

### Worktrees
- **EnterWorktree** / **ExitWorktree** — isolated git worktrees for parallel branch work.

### IDE-specific
- **getDiagnostics** — VS Code language server diagnostics.
- **executeCode** — execute Python in Jupyter kernel.

### MCP Resources
- **ListMcpResourcesTool** / **ReadMcpResourceTool** — access MCP server resources.

### Computer Use
- **Computer** — screenshot, mouse, keyboard for graphical interfaces.

**Total: ~24 built-in tools + unlimited via MCP servers.**

## Claude Code Lifecycle Hooks

25 lifecycle events. Key ones:

| Event | Data | Can Control |
|---|---|---|
| UserPromptSubmit | full prompt text | inject context |
| PreToolUse | tool name, full args, tool_use_id | block, modify, allow, escalate |
| PostToolUse | tool name, args, full result | inject context, block further |
| PostToolUseFailure | same as PostToolUse | same |
| Stop | stop_hook_active (no response text!) | — |
| SessionStart/End | source, model | — |
| SubagentStart/Stop | agent_id, transcript_path | — |

**Gap:** Stop event does not include Claude's response text. Must read from JSONL transcript file.

**Hook types:** command (shell), http (POST), prompt (LLM eval), agent (multi-turn subagent).

## Agent SDK

The Claude Agent SDK packages the Claude Code loop as an embeddable library (TypeScript and Python):
- Built-in tool implementations (same as Claude Code)
- Hooks as programmatic callbacks (not shell commands)
- Direct response streaming (no transcript file workaround)
- Permission model, session management, context compaction
- Designed for Claude Code-like experiences — brings its own tools and context management

## Open Source Agent Frameworks

### Best fit for OpenLight (thinnest, don't own state)
- **Mirascope** — "LLM Anti-Framework." Explicit manual loop. No state ownership. Multi-provider. Python.
- **Raw Anthropic SDK** — zero abstraction, total control. You build everything.
- **LiteLLM** — provider abstraction only (100+ providers). Not a framework. Good utility layer.
- **Vercel AI SDK** — TypeScript. `prepareStep` callback for inter-step logic. No built-in persistence.

### Moderate fit (some opinions, configurable)
- **Pydantic AI** — dependency injection for custom state. `Agent.iter()` for step-by-step control. Python.
- **Magentic** — decorator-based. Thin. Less loop control.

### Poor fit (own too much)
- **Claude Agent SDK** — designed for Claude Code-like experiences, owns context
- **LangGraph** — graph-based, owns state and persistence
- **smolagents** — code-as-action, owns execution context
- **OpenAI Agents SDK** — provider lock-in
- **CrewAI, Google ADK, Microsoft Agent Framework** — heavy multi-agent orchestration

## WebSearch — Server-Side, Zero Implementation

WebSearch is a **built-in server-side capability** of the Anthropic Messages API. Not a tool you implement — you add `{"type": "web_search_20250305", "name": "web_search"}` to the tools array and the API handles everything.

- The model composes the search query itself
- Search executes server-side within the API call
- Response contains both the query (`server_tool_use`) and results (`web_search_tool_result`)
- `$10/1k searches` + standard token costs
- Domain allowlists/blocklists supported
- Also available: `web_search_20260209` with dynamic filtering (model writes code to filter results)

No implementation needed for the pilot. Just include it in the tool definitions.

**Brave Search** is a separate, unrelated option available via MCP. Free tier: 2k queries/month. Useful as a fallback or for vendor independence.

## VM Containment

**Lightweight Linux VM** — not Docker, not process-level sandboxing. Docker and sandbox-runtime (srt) share the host kernel — container escapes are real. For running AI agents with tool execution on a machine with sensitive data, hardware-level isolation with a separate kernel is required.

**The decision:** OrbStack or Lima on macOS (Apple Virtualization.framework), Firecracker on Linux. Real VMs, separate kernels, hardware isolation.

- Project directory mounted via virtio-fs (read/write)
- Public internet allowed (for API calls)
- Private/local network blocked at the VM's virtual network level
- Everything runs inside the VM: SvelteKit server, substrate, invocables
- User interacts via browser on the host (the UI is a web page served from the VM's exposed port)

**Researched alternatives (rejected):**
- `sandbox-runtime` (srt): process-level sandboxing via sandbox-exec/bwrap. Shared kernel — not a real security boundary.
- Docker: on macOS runs a hidden Linux VM anyway. Shared kernel on Linux. Container escapes documented.
- Firecracker: Linux-only, requires KVM. Good for Linux production.
- nsjail: Linux-only, heavier config, still shared kernel.

## CLI Tools and the Anthropic API

CLI tools (executables receiving JSON on stdin) map cleanly to the Anthropic tool format:
- Tool definition: JSON schema in `input_schema`
- Model returns: `tool_use` with structured `input` matching the schema
- You execute: pipe `input` to the CLI, capture stdout
- You send back: `tool_result` with the output

No MCP overhead needed for our own tools. MCP is useful for consuming external tool servers but not required.

## Resolved Questions

- **WebSearch:** Server-side API capability. Zero implementation.
- **CLI alignment:** Direct mapping to Anthropic API format.
- **VM containment:** `sandbox-runtime` for the pilot. Program-agnostic, cross-platform.

## Decisions Made

- **Agent runtime:** Anthropic TypeScript SDK, raw API calls. Own loop, own tools, own context assembly. No framework.
- **Sub-agent lifecycle:** Dispatch chunk tracks status (`running`/`completed`/`failed`), PID, depth. Invocable manages process.
- **Sub-agent nesting:** Allowed with depth limit (3 for pilot). Substrate supports it natively.
- **Containment:** `sandbox-runtime` (srt) for bounded filesystem and network.
- **WebSearch:** Server-side API capability, zero implementation.
- **Tool definitions:** Live in invocable code for the pilot. The invocable knows its own capabilities.
