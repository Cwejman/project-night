package ol

import (
	"encoding/json"
	"testing"
)

const sampleScope = `{
  "scope": ["culture"],
  "head": "abc123",
  "chunks": {"total": 5, "in_scope": 5, "instance": 4, "relates": 1},
  "dimensions": [
    {
      "name": "people",
      "shared": 4, "instance": 2, "relates": 2,
      "connections": [
        {"dim": "education", "instance": 1, "relates": 0},
        {"dim": "projects", "instance": 2, "relates": 0}
      ],
      "edges": []
    },
    {
      "name": "projects",
      "shared": 2, "instance": 2, "relates": 0,
      "connections": [
        {"dim": "people", "instance": 0, "relates": 2}
      ],
      "edges": [
        {"dim": "finance", "instance": 3, "relates": 2}
      ]
    }
  ]
}`

func TestParseScopeResponse(t *testing.T) {
	var resp ScopeResponse
	if err := json.Unmarshal([]byte(sampleScope), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if len(resp.Scope) != 1 || resp.Scope[0] != "culture" {
		t.Fatalf("scope: got %v", resp.Scope)
	}
	if resp.Head != "abc123" {
		t.Fatalf("head: got %q", resp.Head)
	}
	if resp.Chunks.InScope != 5 {
		t.Fatalf("in_scope: got %d", resp.Chunks.InScope)
	}
	if len(resp.Dimensions) != 2 {
		t.Fatalf("dimensions count: got %d", len(resp.Dimensions))
	}

	people := resp.Dimensions[0]
	if people.Name != "people" {
		t.Fatalf("dim 0 name: got %q", people.Name)
	}
	if people.Shared != 4 {
		t.Fatalf("people shared: got %d", people.Shared)
	}
	if len(people.Connections) != 2 {
		t.Fatalf("people connections: got %d", len(people.Connections))
	}

	projects := resp.Dimensions[1]
	if len(projects.Edges) != 1 {
		t.Fatalf("projects edges: got %d", len(projects.Edges))
	}
	if projects.Edges[0].Dim != "finance" {
		t.Fatalf("edge dim: got %q", projects.Edges[0].Dim)
	}
}

func TestParseEmptyScope(t *testing.T) {
	raw := `{"scope":[],"head":"x","chunks":{"total":0,"in_scope":0,"instance":0,"relates":0},"dimensions":[]}`
	var resp ScopeResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(resp.Scope) != 0 {
		t.Fatalf("scope: got %v", resp.Scope)
	}
	if len(resp.Dimensions) != 0 {
		t.Fatalf("dimensions: got %v", resp.Dimensions)
	}
}
