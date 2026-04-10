package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// findSystem walks upward from startDir to find a .openlight/ directory.
// Returns the path to .openlight/ or an error if not found.
func findSystem(startDir string) (string, error) {
	dir, err := filepath.Abs(startDir)
	if err != nil {
		return "", err
	}

	for {
		candidate := filepath.Join(dir, ".openlight")
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			return candidate, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("no .openlight/ found (walked from %s to /). Run `ol init`", startDir)
		}
		dir = parent
	}
}

// dbPath returns the path to system.db within the .openlight/ directory.
func dbPath(systemDir string) string {
	return filepath.Join(systemDir, "system.db")
}

// activeBranch reads the current branch from .openlight/config.json.
func activeBranch(systemDir string) string {
	data, err := os.ReadFile(filepath.Join(systemDir, "config.json"))
	if err != nil {
		return "main"
	}
	var cfg struct {
		Branch string `json:"branch"`
	}
	if json.Unmarshal(data, &cfg) != nil || cfg.Branch == "" {
		return "main"
	}
	return cfg.Branch
}
