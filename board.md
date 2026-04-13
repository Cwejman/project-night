# Board

Current state and what comes next. Updated as things move.

---

## In progress

**Pilot implementation.** The spec is resolved. Build order from `pilot.md`:

1. ~~`ol` — substrate library + CLI.~~ Done.
2. ~~**[Bootstrap](pilot/bootstrap.md)** — seed script.~~ Done.
3. **[Engine](pilot/engine.md)** — dispatch, boundaries, VM, invocable protocol (stdin/stdout pipes).
4. **[UI](pilot/ui.md) scaffold** — SvelteKit app with binary tree tiling.
5. **[UI](pilot/ui.md)** command palette + selector
6. **[UI](pilot/ui.md)** read tile
7. **[UI](pilot/ui.md)** dispatch tile
8. **[Agent](pilot/agent.md)** — claude invocable

UI interaction details (dispatch tile flow, scope-set builders, context lifecycle display) resolve during UI implementation.

---

## Notes

**The strange (`~/git/agi/`).** Referenced in `inside.md` as the intellectual parent. It is loose exploration — night sessions of discussion without ground. The point of `inside.md` is to hold what is true from that exploration; the strange itself is not a source of truth. Sessions should not reach for the strange to resolve questions — if the answer is not in `inside.md`, the inside is what needs work, not the reference.

**README hook.** The current README is acceptable but the formulation exercise is not fully crystallized. The thread of observations across the session is preserved in conversation history. A future session may return to it — the specific things that landed: "projected not generated," "the generative process itself is native to the medium," "the cyclical process of understanding → implementing," "one act of structuring knowledge." Not settled, but the material is there.
