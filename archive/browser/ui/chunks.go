package ui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/openlight/browser/ol"
)

// RenderChunkEntry renders a single chunk, wrapping text to maxWidth.
func RenderChunkEntry(chunk ol.ChunkItem, maxWidth int, selected bool) string {
	var lines []string

	// Text content — wrap to width
	prefix := "  "
	style := Light
	if selected {
		prefix = Bold.Render("▸") + " "
		style = BoldWhite
	}
	first := true
	for _, wl := range WrapText(chunk.Text, maxWidth-2) {
		if first {
			lines = append(lines, prefix+style.Render(wl))
			first = false
		} else {
			lines = append(lines, "  "+style.Render(wl))
		}
	}

	// Key/value pairs
	if len(chunk.KV) > 0 {
		lines = append(lines, "")
		keys := make([]string, 0, len(chunk.KV))
		for k := range chunk.KV {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		maxKey := 0
		for _, k := range keys {
			if len(k) > maxKey {
				maxKey = len(k)
			}
		}

		for _, k := range keys {
			padding := strings.Repeat(" ", maxKey-len(k)+1)
			lines = append(lines, Dim.Render(k)+padding+Light.Render(chunk.KV[k]))
		}
	}

	// Memberships
	if len(chunk.Instance) > 0 || len(chunk.Relates) > 0 {
		lines = append(lines, "")
		if len(chunk.Instance) > 0 {
			var dims []string
			for _, d := range chunk.Instance {
				dims = append(dims, DimName(d))
			}
			lines = append(lines, Dim.Render("instance")+" "+strings.Join(dims, " "))
		}
		if len(chunk.Relates) > 0 {
			var dims []string
			for _, d := range chunk.Relates {
				dims = append(dims, DimName(d))
			}
			lines = append(lines, Dim.Render("relates")+"  "+strings.Join(dims, " "))
		}
	}

	return strings.Join(lines, "\n")
}

// RenderChunksList renders all chunks. cursor < 0 means no selection.
func RenderChunksList(chunks []ol.ChunkItem, counts ol.ChunkCounts, maxWidth int, cursor int) string {
	var b strings.Builder

	header := Light.Render(fmt.Sprintf("%d", counts.InScope)) + " " +
		Dim.Render("chunks") +
		"  " + Dim.Render("instance ") + Light.Render(fmt.Sprintf("%d", counts.Instance)) +
		"  " + Dim.Render("relates ") + Light.Render(fmt.Sprintf("%d", counts.Relates))
	b.WriteString(header)
	b.WriteString("\n\n\n")

	for i, chunk := range chunks {
		b.WriteString(RenderChunkEntry(chunk, maxWidth, i == cursor))
		if i < len(chunks)-1 {
			b.WriteString("\n\n\n")
		}
	}

	return b.String()
}

// WrapText wraps a string to fit within maxWidth, breaking on spaces.
func WrapText(text string, maxWidth int) []string {
	if maxWidth <= 0 || len(text) <= maxWidth {
		return []string{text}
	}

	words := strings.Fields(text)
	if len(words) == 0 {
		return []string{""}
	}

	var lines []string
	current := words[0]

	for _, word := range words[1:] {
		if len(current)+1+len(word) > maxWidth {
			lines = append(lines, current)
			current = word
		} else {
			current += " " + word
		}
	}
	lines = append(lines, current)
	return lines
}
