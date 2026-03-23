package ui

import "github.com/charmbracelet/lipgloss"

// Palette of distinct, readable colors on dark backgrounds.
var DimColors = []lipgloss.Color{
	lipgloss.Color("14"),  // cyan
	lipgloss.Color("10"),  // green
	lipgloss.Color("12"),  // blue
	lipgloss.Color("11"),  // yellow
	lipgloss.Color("13"),  // magenta
	lipgloss.Color("9"),   // red
	lipgloss.Color("117"), // light blue
	lipgloss.Color("178"), // gold
	lipgloss.Color("114"), // light green
	lipgloss.Color("175"), // pink
	lipgloss.Color("81"),  // sky blue
	lipgloss.Color("215"), // orange
	lipgloss.Color("151"), // sage
	lipgloss.Color("183"), // lavender
	lipgloss.Color("216"), // salmon
	lipgloss.Color("116"), // teal
}

// ColorForName returns a deterministic color index for a dimension name.
// FNV-1a hash with bit mixing for even distribution across a small palette.
func ColorForName(name string) int {
	h := uint32(2166136261)
	for _, c := range name {
		h ^= uint32(c)
		h *= 16777619
	}
	h ^= h >> 16
	h *= 0x45d9f3b
	h ^= h >> 16
	return int(h % uint32(len(DimColors)))
}

// DimColor returns the color for a given index.
func DimColor(index int) lipgloss.Color {
	return DimColors[index%len(DimColors)]
}

var (
	Bold      = lipgloss.NewStyle().Bold(true)
	Dim       = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
	Light     = lipgloss.NewStyle().Foreground(lipgloss.Color("7"))
	BoldWhite = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("15"))
	Separator = lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Render("·")
)

// DimName renders a dimension name in its deterministic color.
func DimName(name string) string {
	return lipgloss.NewStyle().
		Foreground(DimColor(ColorForName(name))).
		Render(name)
}

// BoldDimName renders a bold dimension name in its deterministic color.
func BoldDimName(name string) string {
	return lipgloss.NewStyle().
		Bold(true).
		Foreground(DimColor(ColorForName(name))).
		Render(name)
}
