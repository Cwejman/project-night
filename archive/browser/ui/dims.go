package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/openlight/browser/ol"
)

// InsideState describes the navigation state when inside an element.
type InsideState struct {
	Active    bool // whether we're inside this element
	Side      int  // 0=instance, 1=relates
	SubCursor int  // which sub-item is focused
}

// RenderDimEntry renders a single dimension entry for the dims panel.
func RenderDimEntry(dim ol.ScopeDim, selected bool, inside InsideState, maxWidth int, dimSummary string) string {
	var lines []string

	// Name line with cursor indicator
	var nameLine string
	if selected {
		nameLine = " " + Bold.Render("▸") + " " + BoldDimName(dim.Name) + "  " + Light.Render(fmt.Sprintf("%d", dim.Shared))
	} else {
		nameLine = "   " + DimName(dim.Name) + "  " + Light.Render(fmt.Sprintf("%d", dim.Shared))
	}
	lines = append(lines, nameLine)

	// Summary — blank line after name; short in Light, long in Dim
	if dimSummary != "" {
		lines = append(lines, "")
		paras := strings.Split(dimSummary, "\n")
		for pi, para := range paras {
			if para == "" {
				continue
			}
			if pi > 0 {
				lines = append(lines, "")
			}
			style := Light // first paragraph (short) is brighter
			if pi > 0 {
				style = Dim // extended paragraphs are gray
			}
			for _, wl := range WrapText(para, maxWidth-5) {
				lines = append(lines, "     "+style.Render(wl))
			}
		}
	}

	// Instance/relates toggle — only shown when inside
	if inside.Active {
		instLabel := BoldWhite.Render("instance") + " " + Light.Render(fmt.Sprintf("%d", dim.Instance))
		relLabel := Dim.Render("relates") + " " + Dim.Render(fmt.Sprintf("%d", dim.Relates))
		if inside.Side == 1 {
			instLabel = Dim.Render("instance") + " " + Dim.Render(fmt.Sprintf("%d", dim.Instance))
			relLabel = BoldWhite.Render("relates") + " " + Light.Render(fmt.Sprintf("%d", dim.Relates))
		}
		lines = append(lines, "     "+instLabel+"  "+relLabel)
	}

	indent := "     "

	// Sub-connections
	if len(dim.Connections) > 0 {
		lines = append(lines, "")
		if inside.Active {
			for ci, c := range dim.Connections {
				total := c.Instance + c.Relates
				entry := DimName(c.Dim) + " " + Dim.Render(fmt.Sprintf("%d", total))
				if inside.SubCursor == ci {
					lines = append(lines, "   ▸ "+entry)
				} else {
					lines = append(lines, indent+entry)
				}
			}
		} else {
			lines = append(lines, wrapConnections(dim.Connections, indent, maxWidth)...)
		}
	}

	// Edges (outliers)
	if len(dim.Edges) > 0 {
		edgeOffset := len(dim.Connections)
		if inside.Active {
			lines = append(lines, "")
			for ei, e := range dim.Edges {
				total := e.Instance + e.Relates
				edge := lipgloss.NewStyle().Faint(true).Render(DimName(e.Dim)) +
					" " + Dim.Render(fmt.Sprintf("%d", total))
				if inside.SubCursor == edgeOffset+ei {
					lines = append(lines, "   ▸ "+edge)
				} else {
					lines = append(lines, indent+edge)
				}
			}
		} else {
			lines = append(lines, wrapEdges(dim.Edges, indent, maxWidth)...)
		}
	}

	return strings.Join(lines, "\n")
}

// wrapConnections renders connections wrapping to fit within maxWidth.
func wrapConnections(conns []ol.Connection, indent string, maxWidth int) []string {
	var result []string
	sep := "  " + Separator + "  "
	sepVis := 5 // "  ·  "
	indentVis := VisLen(indent)

	currentLine := indent
	currentVis := indentVis

	for i, c := range conns {
		total := c.Instance + c.Relates
		item := DimName(c.Dim) + " " + Dim.Render(fmt.Sprintf("%d", total))
		itemVis := len(c.Dim) + 1 + len(fmt.Sprintf("%d", total))

		addSep := i > 0
		needed := itemVis
		if addSep {
			needed += sepVis
		}

		if currentVis+needed > maxWidth && currentVis > indentVis {
			result = append(result, currentLine)
			currentLine = indent + item
			currentVis = indentVis + itemVis
		} else {
			if addSep {
				currentLine += sep
				currentVis += sepVis
			}
			currentLine += item
			currentVis += itemVis
		}
	}
	if currentVis > indentVis {
		result = append(result, currentLine)
	}
	return result
}

// wrapEdges renders edges wrapping to fit within maxWidth.
func wrapEdges(edges []ol.Connection, indent string, maxWidth int) []string {
	var result []string
	sep := "  " + Separator + "  "
	sepVis := 5
	indentVis := VisLen(indent)

	currentLine := indent
	currentVis := indentVis

	for i, e := range edges {
		total := e.Instance + e.Relates
		item := lipgloss.NewStyle().Faint(true).Render(DimName(e.Dim)) +
			" " + Dim.Render(fmt.Sprintf("%d", total))
		itemVis := len(e.Dim) + 1 + len(fmt.Sprintf("%d", total))

		addSep := i > 0
		needed := itemVis
		if addSep {
			needed += sepVis
		}

		if currentVis+needed > maxWidth && currentVis > indentVis {
			result = append(result, currentLine)
			currentLine = indent + item
			currentVis = indentVis + itemVis
		} else {
			if addSep {
				currentLine += sep
				currentVis += sepVis
			}
			currentLine += item
			currentVis += itemVis
		}
	}
	if currentVis > indentVis {
		result = append(result, currentLine)
	}
	return result
}

// DimsListResult holds rendered dims and their line offsets.
type DimsListResult struct {
	Content    string
	EntryStart []int // start line index for each entry
	EntryEnd   []int // end line index (inclusive) for each entry
	TotalLines int
}

// ScopeSummaryOpts controls the scope summary block at the top of the dims panel.
type ScopeSummaryOpts struct {
	Short    string
	Long     string
	ShowLong bool
	Loading  bool
	Selected bool // cursor is on the scope level
}

// RenderDimsList renders the full dimensions panel with entry position tracking.
func RenderDimsList(dims []ol.ScopeDim, cursor int, inside *InsideState, maxWidth int, dimSummaries map[string]string, scopeSummary ScopeSummaryOpts) DimsListResult {
	var result DimsListResult
	var allLines []string

	// Scope summary at top of dims panel (cursor -1 = selected)
	scopeStart := len(allLines)
	if scopeSummary.Loading {
		prefix := "   "
		if scopeSummary.Selected {
			prefix = " " + Bold.Render("▸") + " "
		}
		allLines = append(allLines, prefix+Dim.Render("summarizing..."), "")
	} else if scopeSummary.Short != "" {
		style := Light
		prefix := "   "
		if scopeSummary.Selected {
			prefix = " " + Bold.Render("▸") + " "
			style = BoldWhite
		}
		first := true
		for _, wl := range WrapText(scopeSummary.Short, maxWidth-4) {
			if first {
				allLines = append(allLines, prefix+style.Render(wl))
				first = false
			} else {
				allLines = append(allLines, "     "+style.Render(wl))
			}
		}
		if scopeSummary.ShowLong && scopeSummary.Long != "" {
			allLines = append(allLines, "")
			for _, wl := range WrapText(scopeSummary.Long, maxWidth-5) {
				allLines = append(allLines, "     "+Dim.Render(wl))
			}
		}
		allLines = append(allLines, "", "")
	}
	scopeEnd := len(allLines) - 1
	if scopeEnd < scopeStart {
		scopeEnd = scopeStart
	}
	// Entry -1 is the scope summary block
	result.EntryStart = append(result.EntryStart, scopeStart)
	result.EntryEnd = append(result.EntryEnd, scopeEnd)

	for i, dim := range dims {
		if i > 0 {
			allLines = append(allLines, "", "")
		}
		var is InsideState
		if inside != nil && i == cursor {
			is = *inside
		}
		var ds string
		if dimSummaries != nil {
			ds = dimSummaries[dim.Name]
		}
		entry := RenderDimEntry(dim, i == cursor, is, maxWidth, ds)
		entryLines := strings.Split(entry, "\n")

		start := len(allLines)
		allLines = append(allLines, entryLines...)
		end := len(allLines) - 1

		result.EntryStart = append(result.EntryStart, start)
		result.EntryEnd = append(result.EntryEnd, end)
	}

	result.Content = strings.Join(allLines, "\n")
	result.TotalLines = len(allLines)
	return result
}
