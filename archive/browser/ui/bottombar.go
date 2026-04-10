package ui

import (
	"fmt"

	"github.com/openlight/browser/ol"
)

// BottomBar renders the keybind hints for normal mode.
func BottomBar() string {
	return " " + BoldWhite.Render("hjkl") + Dim.Render("/") +
		BoldWhite.Render("tab") + Dim.Render(" navigate  ") +
		BoldWhite.Render("t") + Dim.Render("oggle  ") +
		BoldWhite.Render("a") + Dim.Render("dd  ") +
		BoldWhite.Render("d") + Dim.Render("rop  ") +
		BoldWhite.Render("p") + Dim.Render("ull  ") +
		BoldWhite.Render("b") + Dim.Render("ranch  ") +
		BoldWhite.Render("u") + Dim.Render("ndo  ") +
		BoldWhite.Render("r") + Dim.Render("edo  ") +
		BoldWhite.Render("q") + Dim.Render("uit")
}

// DropBar renders the drop mode bar with numbered scope dimensions.
// 0 = last added (easy pop). 1-9 = position.
func DropBar(scope []string) string {
	s := " " + Dim.Render("drop: ")
	for i, name := range scope {
		num := i + 1
		if i == len(scope)-1 {
			num = 0
		}
		s += BoldWhite.Render(fmt.Sprintf("%d", num)) + Dim.Render("=") + DimName(name) + "  "
	}
	s += Dim.Render("(any other key cancels)")
	return s
}

// PullBar renders the pull mode bar with text input.
func PullBar(input string) string {
	return " " + Dim.Render("pull: ") + Light.Render(input) + BoldWhite.Render("_") +
		"  " + Dim.Render("enter to add, esc to cancel")
}

// ToggleBar renders the toggle sub-mode options.
func ToggleBar() string {
	return " " + Dim.Render("toggle: ") +
		BoldWhite.Render("d") + Dim.Render("ims  ") +
		BoldWhite.Render("c") + Dim.Render("hunks  ") +
		BoldWhite.Render("s") + Dim.Render("ummary detail  ") +
		Dim.Render("(any other key cancels)")
}

// BranchBar renders the branch picker bar.
func BranchBar(branches []ol.Branch, current string) string {
	s := " " + Dim.Render("branch: ")
	for i, b := range branches {
		if i >= 9 {
			break
		}
		name := b.Name
		if name == current {
			s += BoldWhite.Render(fmt.Sprintf("%d", i+1)) + Dim.Render("=") + BoldWhite.Render(name) + Dim.Render("*") + "  "
		} else {
			s += BoldWhite.Render(fmt.Sprintf("%d", i+1)) + Dim.Render("=") + Light.Render(name) + "  "
		}
	}
	s += Dim.Render("(any other key cancels)")
	return s
}
