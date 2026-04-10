package main

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/openlight/browser/ol"
)

func testModel() model {
	m := newModel()
	m.width = 80
	m.height = 30
	m.scope = &ol.ScopeResponse{
		Scope: []string{"culture"},
		Head:  "abc123",
		Chunks: ol.ChunkCounts{
			Total: 5, InScope: 5, Instance: 4, Relates: 1,
		},
		Dimensions: []ol.ScopeDim{
			{
				Name: "people", Shared: 4, Instance: 2, Relates: 2,
				Connections: []ol.Connection{
					{Dim: "education", Instance: 1, Relates: 0},
					{Dim: "projects", Instance: 2, Relates: 0},
				},
			},
			{Name: "projects", Shared: 2},
			{Name: "education", Shared: 1},
		},
	}
	return m
}

func sendKey(m model, key string) model {
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
	return updated.(model)
}

func TestNavigation_JK(t *testing.T) {
	m := testModel()

	if m.cursor != 0 {
		t.Fatalf("initial cursor: got %d, want 0", m.cursor)
	}

	m = sendKey(m, "j")
	if m.cursor != 1 {
		t.Fatalf("after j: got %d, want 1", m.cursor)
	}

	m = sendKey(m, "j")
	if m.cursor != 2 {
		t.Fatalf("after jj: got %d, want 2", m.cursor)
	}

	// Clamp at bottom
	m = sendKey(m, "j")
	if m.cursor != 2 {
		t.Fatalf("after jjj (clamp): got %d, want 2", m.cursor)
	}

	m = sendKey(m, "k")
	if m.cursor != 1 {
		t.Fatalf("after k: got %d, want 1", m.cursor)
	}

	// Back to scope level (-1)
	m = sendKey(m, "k")
	m = sendKey(m, "k")
	m = sendKey(m, "k")
	if m.cursor != -1 {
		t.Fatalf("clamp at scope: got %d, want -1", m.cursor)
	}
}

func TestNavigation_Quit(t *testing.T) {
	m := testModel()
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	_ = updated
	if cmd == nil {
		t.Fatal("q should produce a quit command")
	}
}

func TestWindowResize(t *testing.T) {
	m := testModel()
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	m2 := updated.(model)
	if m2.width != 120 || m2.height != 40 {
		t.Fatalf("resize: got %dx%d", m2.width, m2.height)
	}
}

func TestDropMode_Enter(t *testing.T) {
	m := testModel()
	m = sendKey(m, "d")
	if m.mode != modeDrop {
		t.Fatalf("mode: got %d, want modeDrop", m.mode)
	}
}

func TestDropMode_Cancel(t *testing.T) {
	m := testModel()
	m = sendKey(m, "d")
	m = sendKey(m, "x") // non-digit cancels
	if m.mode != modeNormal {
		t.Fatalf("mode after cancel: got %d, want modeNormal", m.mode)
	}
}

func TestDropMode_NoScopeNoop(t *testing.T) {
	m := testModel()
	m.scope.Scope = []string{}
	m = sendKey(m, "d")
	if m.mode != modeNormal {
		t.Fatalf("drop with empty scope should be noop, got mode %d", m.mode)
	}
}

func TestPullMode_Enter(t *testing.T) {
	m := testModel()
	m = sendKey(m, "p")
	if m.mode != modePull {
		t.Fatalf("mode: got %d, want modePull", m.mode)
	}
}

func TestPullMode_EscCancel(t *testing.T) {
	m := testModel()
	m = sendKey(m, "p")
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEscape})
	m = updated.(model)
	if m.mode != modeNormal {
		t.Fatalf("mode after esc: got %d", m.mode)
	}
}

func TestPullMode_TypeAndSubmit(t *testing.T) {
	m := testModel()
	m = sendKey(m, "p")
	// Type "people"
	for _, ch := range "people" {
		m = sendKey(m, string(ch))
	}
	if m.pullInput != "people" {
		t.Fatalf("pullInput: got %q", m.pullInput)
	}
	// Submit — should trigger fetch (loading=true)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(model)
	if m.mode != modeNormal {
		t.Fatalf("mode after enter: got %d", m.mode)
	}
	// cmd should be non-nil (fetch command) — but client is nil so it returns empty scopeMsg
	if cmd != nil {
		msg := cmd()
		if msg == nil {
			t.Fatal("expected scopeMsg")
		}
	}
}

func TestPullMode_Backspace(t *testing.T) {
	m := testModel()
	m = sendKey(m, "p")
	m = sendKey(m, "a")
	m = sendKey(m, "b")
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyBackspace})
	m = updated.(model)
	if m.pullInput != "a" {
		t.Fatalf("pullInput after backspace: got %q, want %q", m.pullInput, "a")
	}
}

func TestAddFocusedDim(t *testing.T) {
	m := testModel()
	// Cursor on "people" (index 0)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("a")})
	m = updated.(model)
	if !m.loading {
		t.Fatal("expected loading after add")
	}
	// cmd should be a fetch function
	if cmd == nil {
		t.Fatal("expected non-nil cmd")
	}
}

func TestAddDuplicateNoop(t *testing.T) {
	m := testModel()
	// Add "culture" which is already in scope
	m.scope.Dimensions = []ol.ScopeDim{{Name: "culture", Shared: 5}}
	m.cursor = 0
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("a")})
	m = updated.(model)
	if m.loading {
		t.Fatal("adding duplicate should be noop")
	}
	if cmd != nil {
		t.Fatal("expected nil cmd for duplicate add")
	}
}

func TestInsideDim_EnterAndExit(t *testing.T) {
	m := testModel()

	// Enter the first dim (people)
	m = sendKey(m, "l")
	if m.navLevel != levelInsideDim {
		t.Fatalf("navLevel after l: got %d, want levelInsideDim", m.navLevel)
	}
	if m.side != sideInstance {
		t.Fatalf("side: got %d, want sideInstance", m.side)
	}

	// Switch to relates
	m = sendKey(m, "l")
	if m.side != sideRelates {
		t.Fatalf("side after l: got %d, want sideRelates", m.side)
	}

	// Switch back to instance
	m = sendKey(m, "h")
	if m.side != sideInstance {
		t.Fatalf("side after h: got %d, want sideInstance", m.side)
	}

	// Exit back to entry level (h at instance)
	m = sendKey(m, "h")
	if m.navLevel != levelEntry {
		t.Fatalf("navLevel after exit: got %d, want levelEntry", m.navLevel)
	}
}

func TestInsideDim_SubNavigation(t *testing.T) {
	m := testModel()
	m = sendKey(m, "l") // enter people

	// people has 2 connections: education, projects
	if m.subCursor != 0 {
		t.Fatalf("initial subCursor: got %d", m.subCursor)
	}

	m = sendKey(m, "j")
	if m.subCursor != 1 {
		t.Fatalf("subCursor after j: got %d", m.subCursor)
	}

	// Clamp at bottom
	m = sendKey(m, "j")
	if m.subCursor != 1 {
		t.Fatalf("subCursor clamp: got %d", m.subCursor)
	}

	m = sendKey(m, "k")
	if m.subCursor != 0 {
		t.Fatalf("subCursor after k: got %d", m.subCursor)
	}
}

func TestInsideDim_AddSubDim(t *testing.T) {
	m := testModel()
	m = sendKey(m, "l") // enter people

	// a should add "education" (subCursor=0, first connection)
	updated, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("a")})
	m = updated.(model)

	if m.navLevel != levelEntry {
		t.Fatalf("navLevel after add: got %d, want levelEntry", m.navLevel)
	}
	if !m.loading {
		t.Fatal("expected loading after add from inside")
	}
	if cmd == nil {
		t.Fatal("expected non-nil cmd")
	}
}
