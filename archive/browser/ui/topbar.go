package ui

import (
	"fmt"
	"strings"

	"github.com/openlight/browser/ol"
)

// TopBar renders the scope bar with branch, scope dims and aggregate counts.
func TopBar(resp *ol.ScopeResponse, branch string) string {
	branchLabel := Dim.Render(branch)

	var scopeLabel string
	if len(resp.Scope) == 0 {
		scopeLabel = Dim.Render("{}")
	} else {
		var parts []string
		for _, name := range resp.Scope {
			parts = append(parts, BoldDimName(name))
		}
		scopeLabel = strings.Join(parts, Dim.Render(", "))
	}

	counts := fmt.Sprintf("%d", resp.Chunks.InScope)

	return " " + branchLabel + "  " + scopeLabel + "  " + Light.Render(counts)
}
