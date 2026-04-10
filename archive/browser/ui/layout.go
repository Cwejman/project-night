package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

const Gap = 4

// VisLen returns the visible (printed) width of a string, handling ANSI and unicode.
func VisLen(s string) int {
	return lipgloss.Width(s)
}

// Pad pads a string to the given visible width.
func Pad(s string, width int) string {
	diff := width - VisLen(s)
	if diff > 0 {
		return s + strings.Repeat(" ", diff)
	}
	return s
}

// TruncateToWidth truncates a line to fit within maxWidth visible characters.
func TruncateToWidth(s string, maxWidth int) string {
	if VisLen(s) <= maxWidth {
		return s
	}
	runes := []rune(s)
	for i := len(runes); i > 0; i-- {
		candidate := string(runes[:i])
		if VisLen(candidate) <= maxWidth {
			return candidate
		}
	}
	return ""
}

// PanelWidth returns the width for each panel given terminal width.
func PanelWidth(termWidth int) int {
	return (termWidth - Gap) / 2
}

// MergePanels merges left and right panel lines side by side.
func MergePanels(left, right string, leftWidth int) string {
	leftLines := strings.Split(left, "\n")
	rightLines := strings.Split(right, "\n")

	max := len(leftLines)
	if len(rightLines) > max {
		max = len(rightLines)
	}

	var lines []string
	gap := strings.Repeat(" ", Gap)
	for i := 0; i < max; i++ {
		l := ""
		if i < len(leftLines) {
			l = leftLines[i]
		}
		r := ""
		if i < len(rightLines) {
			r = rightLines[i]
		}
		if VisLen(l) > leftWidth {
			l = TruncateToWidth(l, leftWidth)
		}
		lines = append(lines, Pad(l, leftWidth)+gap+r)
	}

	return strings.Join(lines, "\n")
}
