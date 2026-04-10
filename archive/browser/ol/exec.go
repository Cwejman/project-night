package ol

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// Client executes ol commands against a specific database.
type Client struct {
	DBPath string
}

// Scope runs `ol scope [dims...] --format json` and parses the result.
func (c *Client) Scope(dims ...string) (*ScopeResponse, error) {
	args := []string{"scope"}
	args = append(args, dims...)
	args = append(args, "--db", c.DBPath, "--format", "json")

	out, err := exec.Command("ol", args...).Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("ol scope: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, fmt.Errorf("ol scope: %w", err)
	}

	var resp ScopeResponse
	if err := json.Unmarshal(out, &resp); err != nil {
		return nil, fmt.Errorf("ol scope: parse error: %w", err)
	}
	return &resp, nil
}

// ScopeWithChunks runs `ol scope [dims...] --chunks --format json`.
func (c *Client) ScopeWithChunks(dims ...string) (*ScopeResponse, error) {
	args := []string{"scope"}
	args = append(args, dims...)
	args = append(args, "--chunks", "--db", c.DBPath, "--format", "json")

	out, err := exec.Command("ol", args...).Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("ol scope --chunks: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, fmt.Errorf("ol scope --chunks: %w", err)
	}

	var resp ScopeResponse
	if err := json.Unmarshal(out, &resp); err != nil {
		return nil, fmt.Errorf("ol scope --chunks: parse error: %w", err)
	}
	return &resp, nil
}

// BranchList runs `ol branch list --format json`.
func (c *Client) BranchList() ([]Branch, error) {
	out, err := exec.Command("ol", "branch", "list", "--db", c.DBPath, "--format", "json").Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("ol branch list: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, fmt.Errorf("ol branch list: %w", err)
	}
	var resp BranchListResponse
	if err := json.Unmarshal(out, &resp); err != nil {
		return nil, fmt.Errorf("ol branch list: parse error: %w", err)
	}
	return resp.Branches, nil
}

// BranchSwitch runs `ol branch switch <name>`.
func (c *Client) BranchSwitch(name string) error {
	out, err := exec.Command("ol", "branch", "switch", name, "--db", c.DBPath).CombinedOutput()
	if err != nil {
		return fmt.Errorf("ol branch switch: %s", strings.TrimSpace(string(out)))
	}
	return nil
}
