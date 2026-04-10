package nav

import (
	"reflect"
	"testing"
)

func TestHistory_Basic(t *testing.T) {
	h := NewHistory([]string{"culture"})

	if !reflect.DeepEqual(h.Current(), []string{"culture"}) {
		t.Fatalf("initial: %v", h.Current())
	}

	if h.CanUndo() {
		t.Fatal("should not be able to undo at start")
	}
	if h.CanRedo() {
		t.Fatal("should not be able to redo at start")
	}
}

func TestHistory_PushAndUndo(t *testing.T) {
	h := NewHistory([]string{"culture"})
	h.Push([]string{"culture", "people"})
	h.Push([]string{"culture", "people", "projects"})

	if !reflect.DeepEqual(h.Current(), []string{"culture", "people", "projects"}) {
		t.Fatalf("after push: %v", h.Current())
	}

	got := h.Undo()
	if !reflect.DeepEqual(got, []string{"culture", "people"}) {
		t.Fatalf("after first undo: %v", got)
	}

	got = h.Undo()
	if !reflect.DeepEqual(got, []string{"culture"}) {
		t.Fatalf("after second undo: %v", got)
	}

	// At start, undo returns current
	got = h.Undo()
	if !reflect.DeepEqual(got, []string{"culture"}) {
		t.Fatalf("undo at start: %v", got)
	}
}

func TestHistory_Redo(t *testing.T) {
	h := NewHistory([]string{"culture"})
	h.Push([]string{"culture", "people"})
	h.Push([]string{"culture", "people", "projects"})

	h.Undo()
	h.Undo()

	got := h.Redo()
	if !reflect.DeepEqual(got, []string{"culture", "people"}) {
		t.Fatalf("after redo: %v", got)
	}

	got = h.Redo()
	if !reflect.DeepEqual(got, []string{"culture", "people", "projects"}) {
		t.Fatalf("after second redo: %v", got)
	}

	// At end, redo returns current
	got = h.Redo()
	if !reflect.DeepEqual(got, []string{"culture", "people", "projects"}) {
		t.Fatalf("redo at end: %v", got)
	}
}

func TestHistory_TruncateOnPush(t *testing.T) {
	h := NewHistory([]string{"culture"})
	h.Push([]string{"culture", "people"})
	h.Push([]string{"culture", "people", "projects"})

	h.Undo() // back to "culture", "people"
	h.Push([]string{"culture", "education"})

	if h.CanRedo() {
		t.Fatal("should not be able to redo after new push")
	}

	if !reflect.DeepEqual(h.Current(), []string{"culture", "education"}) {
		t.Fatalf("after truncation: %v", h.Current())
	}
}

func TestHistory_EmptyScope(t *testing.T) {
	h := NewHistory([]string{})
	h.Push([]string{"culture"})

	got := h.Undo()
	if len(got) != 0 {
		t.Fatalf("empty scope undo: %v", got)
	}
}

func TestHistory_Isolation(t *testing.T) {
	// Verify pushing doesn't share slices
	scope := []string{"culture", "people"}
	h := NewHistory(scope)
	scope[0] = "modified"

	if h.Current()[0] != "culture" {
		t.Fatal("history should copy, not reference")
	}
}
