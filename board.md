# Board

Current state and what comes next. Updated as things move.

---

## In progress

**Inside purification.** The values and visions in `inside.md` have been through a deep refinement pass. The inside is held well enough to orient the pilot and the InsideOut work.

---

## Next — in priority order

**1. Pilot requirements — architecture settled, open items remain.**
Core architecture resolved: engine (dispatch, boundaries, VM, invocable protocol) sits between substrate lib and everything that dispatches. Spec composition implemented (`propagate` in spec.ts). Host/VM split settled: lib, engine, UI on host; invocables in VM; engine mediates all database access.
Remaining open before building:
- Invocable protocol transport (HTTP, WebSocket, Unix socket).
- Dispatch tile user flow (selection vs creation, inline context/boundary assembly).
- UI inference for unordered scope-set types (boundaries).
- Context lifecycle in the UI (pinned vs evolved, no structural distinction yet).
- `interface.md` alignment with settled pilot decisions.

**2. Pilot implementation.**
Comes after the pilot requirements are resolved. The build order in `pilot.md` is the starting point.

---

## Notes

**The strange (`~/git/agi/`).** Referenced in `inside.md` as the intellectual parent. It is loose exploration — night sessions of discussion without ground. The point of `inside.md` is to hold what is true from that exploration; the strange itself is not a source of truth. Sessions should not reach for the strange to resolve questions — if the answer is not in `inside.md`, the inside is what needs work, not the reference.

**README hook.** The current README is acceptable but the formulation exercise is not fully crystallized. The thread of observations across the session is preserved in conversation history. A future session may return to it — the specific things that landed: "projected not generated," "the generative process itself is native to the medium," "the cyclical process of understanding → implementing," "one act of structuring knowledge." Not settled, but the material is there.
