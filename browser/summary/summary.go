package summary

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/openlight/browser/ol"
)

// Summary holds a short one-liner and an optional longer expansion.
type Summary struct {
	Short string `json:"short"`
	Long  string `json:"long"`
}

// DimSummaries is the cached map of all dim summaries for a given HEAD.
type DimSummaries struct {
	Dims map[string]Summary `json:"dims"`
}

// Cache stores dim summaries keyed by HEAD commit, backed by disk.
type Cache struct {
	mu      sync.Mutex
	mem     map[string]*DimSummaries
	scope   map[string]Summary // scope summaries keyed by scope+head
	diskDir string
}

func NewCache(systemDir string) *Cache {
	dir := filepath.Join(systemDir, "cache", "summaries")
	os.MkdirAll(dir, 0755)
	return &Cache{
		mem:     make(map[string]*DimSummaries),
		scope:   make(map[string]Summary),
		diskDir: dir,
	}
}

// GetDims returns cached dim summaries for this HEAD, loading from disk if needed.
func (c *Cache) GetDims(head string) (*DimSummaries, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if v, ok := c.mem[head]; ok {
		return v, true
	}
	path := filepath.Join(c.diskDir, "dims-"+head+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	var ds DimSummaries
	if json.Unmarshal(data, &ds) != nil {
		return nil, false
	}
	c.mem[head] = &ds
	return &ds, true
}

// SetDims caches dim summaries for this HEAD.
func (c *Cache) SetDims(head string, ds *DimSummaries) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.mem[head] = ds
	data, err := json.Marshal(ds)
	if err == nil {
		os.WriteFile(filepath.Join(c.diskDir, "dims-"+head+".json"), data, 0644)
	}
}

// GetScope returns a cached scope summary.
func (c *Cache) GetScope(key string) (Summary, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	v, ok := c.scope[key]
	return v, ok
}

// SetScope caches a scope summary.
func (c *Cache) SetScope(key string, s Summary) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.scope[key] = s
}

// ScopeKey builds a cache key from scope dimensions and HEAD.
func ScopeKey(scope []string, head string) string {
	joined := strings.Join(scope, ",") + "@" + head
	return fmt.Sprintf("%x", joined)
}

// GenerateDims generates summaries for all given dims in one claude call.
// Seeded from {culture}. Results are scope-independent.
func GenerateDims(client *ol.Client, allDims []string) (*DimSummaries, error) {
	cultureResp, err := client.ScopeWithChunks("culture")
	if err != nil {
		return nil, fmt.Errorf("fetch culture context: %w", err)
	}

	var ctx strings.Builder
	ctx.WriteString("You are summarizing dimensions in a knowledge system. The system's culture and values are below.\n\n")
	for _, chunk := range cultureResp.Chunks.Items {
		ctx.WriteString("---\n")
		ctx.WriteString(chunk.Text + "\n")
		if len(chunk.Instance) > 0 {
			ctx.WriteString("instance: " + strings.Join(chunk.Instance, ", ") + "\n")
		}
		if len(chunk.Relates) > 0 {
			ctx.WriteString("relates: " + strings.Join(chunk.Relates, ", ") + "\n")
		}
	}

	var prompt strings.Builder
	prompt.WriteString("For each dimension below, write:\n")
	prompt.WriteString("- First line: a single sentence that captures the essence.\n")
	prompt.WriteString("- Then a blank line, followed by 2-4 more sentences expanding — what it covers, why it matters, how it connects.\n\n")
	prompt.WriteString("Use this exact format, entries separated by a blank line, no extra text:\n\n")
	for _, d := range allDims {
		prompt.WriteString(fmt.Sprintf("%s: <one sentence>\n<expanding paragraph>\n\n", d))
	}

	cmd := exec.Command("claude", "-p", "--model", "haiku", "--system-prompt", ctx.String())
	cmd.Stdin = strings.NewReader(prompt.String())

	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("claude: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, fmt.Errorf("claude: %w", err)
	}

	return parseDimSummaries(string(out), allDims), nil
}

// GenerateScope generates a scope-level summary. Fast — one sentence + paragraph.
func GenerateScope(client *ol.Client, scope []string) (Summary, error) {
	cultureResp, err := client.ScopeWithChunks("culture")
	if err != nil {
		return Summary{}, fmt.Errorf("fetch culture context: %w", err)
	}

	var ctx strings.Builder
	ctx.WriteString("You are summarizing a scope in a knowledge system. Culture context below.\n\n")
	for _, chunk := range cultureResp.Chunks.Items {
		ctx.WriteString("---\n")
		ctx.WriteString(chunk.Text + "\n")
	}

	scopeResp, _ := client.ScopeWithChunks(scope...)

	var prompt strings.Builder
	if len(scope) == 0 {
		prompt.WriteString("Scope: {} (all dimensions)\n\n")
	} else {
		prompt.WriteString(fmt.Sprintf("Scope: {%s}\n\n", strings.Join(scope, ", ")))
	}
	if scopeResp != nil {
		prompt.WriteString(fmt.Sprintf("Chunks in scope: %d\n", scopeResp.Chunks.InScope))
		prompt.WriteString("Connected dimensions: ")
		for i, d := range scopeResp.Dimensions {
			if i > 0 {
				prompt.WriteString(", ")
			}
			prompt.WriteString(fmt.Sprintf("%s(%d)", d.Name, d.Shared))
		}
		prompt.WriteString("\n\n")
	}
	prompt.WriteString("Write one sentence capturing this scope, then a blank line, then 2-3 expanding sentences.\n")
	prompt.WriteString("No label, just the text directly.\n")

	cmd := exec.Command("claude", "-p", "--model", "haiku", "--system-prompt", ctx.String())
	cmd.Stdin = strings.NewReader(prompt.String())

	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return Summary{}, fmt.Errorf("claude: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return Summary{}, fmt.Errorf("claude: %w", err)
	}

	return parseScopeSummary(string(out)), nil
}

func parseDimSummaries(raw string, dims []string) *DimSummaries {
	ds := &DimSummaries{Dims: make(map[string]Summary)}
	validKeys := make(map[string]bool)
	for _, d := range dims {
		validKeys[d] = true
	}

	var currentKey string
	var lines []string

	flush := func() {
		if currentKey == "" {
			return
		}
		ds.Dims[currentKey] = buildSummary(lines)
		currentKey = ""
		lines = nil
	}

	for _, line := range strings.Split(strings.TrimSpace(raw), "\n") {
		idx := strings.Index(line, ": ")
		if idx > 0 {
			candidate := strings.TrimSpace(line[:idx])
			if validKeys[candidate] {
				flush()
				currentKey = candidate
				lines = append(lines, strings.TrimSpace(line[idx+2:]))
				continue
			}
		}
		if currentKey != "" {
			lines = append(lines, line)
		}
	}
	flush()
	return ds
}

func parseScopeSummary(raw string) Summary {
	lines := strings.Split(strings.TrimSpace(raw), "\n")
	if len(lines) == 0 {
		return Summary{}
	}
	return buildSummary(lines)
}

func buildSummary(lines []string) Summary {
	if len(lines) == 0 {
		return Summary{}
	}
	short := strings.TrimSpace(lines[0])
	var longParts []string
	pastBlank := false
	for _, l := range lines[1:] {
		trimmed := strings.TrimSpace(l)
		if trimmed == "" {
			pastBlank = true
			continue
		}
		if pastBlank || len(longParts) > 0 {
			longParts = append(longParts, trimmed)
		}
	}
	return Summary{
		Short: short,
		Long:  strings.Join(longParts, " "),
	}
}
