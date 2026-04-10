package nav

// History tracks scope states for undo/redo.
// Only scope mutations (add/drop/pull) push to the stack.
type History struct {
	states  [][]string // stack of scope states
	pointer int        // current position in stack
}

// NewHistory creates a history with the given initial scope.
func NewHistory(initial []string) *History {
	return &History{
		states:  [][]string{copyScope(initial)},
		pointer: 0,
	}
}

// Push records a new scope state. Truncates any redo history.
func (h *History) Push(scope []string) {
	h.pointer++
	h.states = append(h.states[:h.pointer], copyScope(scope))
}

// CanUndo returns true if there's a previous state.
func (h *History) CanUndo() bool {
	return h.pointer > 0
}

// CanRedo returns true if there's a next state.
func (h *History) CanRedo() bool {
	return h.pointer < len(h.states)-1
}

// Undo moves back one state and returns it.
func (h *History) Undo() []string {
	if !h.CanUndo() {
		return h.Current()
	}
	h.pointer--
	return h.Current()
}

// Redo moves forward one state and returns it.
func (h *History) Redo() []string {
	if !h.CanRedo() {
		return h.Current()
	}
	h.pointer++
	return h.Current()
}

// Current returns the current scope state.
func (h *History) Current() []string {
	return copyScope(h.states[h.pointer])
}

func copyScope(s []string) []string {
	c := make([]string, len(s))
	copy(c, s)
	return c
}
