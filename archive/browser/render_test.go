package main

import (
	"fmt"
	"os"
	"testing"

	"github.com/charmbracelet/lipgloss"
	"github.com/muesli/termenv"
	"github.com/openlight/browser/ol"
)

func setupColors() {
	lipgloss.SetDefaultRenderer(lipgloss.NewRenderer(os.Stdout, termenv.WithProfile(termenv.ANSI256)))
}

func TestRenderView(t *testing.T) {
	setupColors()

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
			{
				Name: "projects", Shared: 2, Instance: 2, Relates: 0,
				Connections: []ol.Connection{
					{Dim: "people", Instance: 0, Relates: 2},
					{Dim: "education", Instance: 1, Relates: 0},
				},
			},
			{
				Name: "education", Shared: 1, Instance: 1, Relates: 0,
				Connections: []ol.Connection{
					{Dim: "people", Instance: 0, Relates: 1},
					{Dim: "projects", Instance: 1, Relates: 0},
				},
			},
		},
	}


	view := m.View()
	fmt.Println(view)

	if len(view) == 0 {
		t.Fatal("empty view")
	}
}

func TestRenderInsideDim(t *testing.T) {
	setupColors()

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
			{
				Name: "projects", Shared: 2, Instance: 2, Relates: 0,
				Connections: []ol.Connection{
					{Dim: "people", Instance: 0, Relates: 2},
				},
			},
			{
				Name: "education", Shared: 1, Instance: 1, Relates: 0,
				Connections: []ol.Connection{
					{Dim: "people", Instance: 0, Relates: 1},
				},
			},
		},
	}

	m.navLevel = levelInsideDim
	m.side = sideInstance
	m.subCursor = 0 // education selected

	view := m.View()
	fmt.Println(view)

	if len(view) == 0 {
		t.Fatal("empty view")
	}
}

func TestRenderSplitView(t *testing.T) {
	setupColors()

	m := newModel()
	m.width = 120
	m.height = 35
	m.showDims = true
	m.showChunks = true
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
			{
				Name: "projects", Shared: 2, Instance: 2, Relates: 0,
				Connections: []ol.Connection{
					{Dim: "people", Instance: 0, Relates: 2},
				},
			},
			{
				Name: "education", Shared: 1, Instance: 1, Relates: 0,
				Connections: []ol.Connection{
					{Dim: "people", Instance: 0, Relates: 1},
				},
			},
		},
	}
	m.chunks = []ol.ChunkItem{
		{
			ID:   "c1",
			Text: "Alice joined the founding team in March 2024",
			KV:   map[string]string{"name": "Alice Chen", "role": "Community Lead"},
			Instance: []string{"culture", "people"},
			Relates:  []string{"education"},
		},
		{
			ID:   "c2",
			Text: "The summer youth program runs on a 30-day cycle",
			KV:   map[string]string{"status": "active"},
			Instance: []string{"culture", "projects"},
			Relates:  []string{"people", "education"},
		},
		{
			ID:   "c3",
			Text: "Bob transitioned from volunteer to staff",
			KV:   map[string]string{"name": "Bob Rivera", "role": "Program Director"},
			Instance: []string{"culture", "people"},
			Relates:  []string{"projects"},
		},
	}
	m.chunkCounts = ol.ChunkCounts{InScope: 5, Instance: 3, Relates: 2}


	view := m.View()
	fmt.Println(view)

	if len(view) == 0 {
		t.Fatal("empty view")
	}
}
