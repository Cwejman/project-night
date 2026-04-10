package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindSystem_AtCwd(t *testing.T) {
	tmp := t.TempDir()
	olDir := filepath.Join(tmp, ".openlight")
	if err := os.Mkdir(olDir, 0755); err != nil {
		t.Fatal(err)
	}

	got, err := findSystem(tmp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != olDir {
		t.Fatalf("got %q, want %q", got, olDir)
	}
}

func TestFindSystem_NestedDir(t *testing.T) {
	tmp := t.TempDir()
	olDir := filepath.Join(tmp, ".openlight")
	if err := os.Mkdir(olDir, 0755); err != nil {
		t.Fatal(err)
	}

	nested := filepath.Join(tmp, "a", "b", "c")
	if err := os.MkdirAll(nested, 0755); err != nil {
		t.Fatal(err)
	}

	got, err := findSystem(nested)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != olDir {
		t.Fatalf("got %q, want %q", got, olDir)
	}
}

func TestFindSystem_NotFound(t *testing.T) {
	tmp := t.TempDir()
	_, err := findSystem(tmp)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestDbPath(t *testing.T) {
	got := dbPath("/home/user/.openlight")
	want := "/home/user/.openlight/system.db"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
