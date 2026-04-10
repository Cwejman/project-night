package main

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/openlight/browser/nav"
	"github.com/openlight/browser/ol"
	"github.com/openlight/browser/summary"
	"github.com/openlight/browser/ui"
)

type mode int

const (
	modeNormal mode = iota
	modeDrop
	modePull
	modeBranch
	modeToggle
)

type panel int

const (
	panelDims panel = iota
	panelChunks
)

type navLevel int

const (
	levelEntry navLevel = iota
	levelInsideDim
	levelInsideChunk
)

type memberSide int

const (
	sideInstance memberSide = iota
	sideRelates
)

type model struct {
	width      int
	height     int
	client     *ol.Client
	scope      *ol.ScopeResponse
	err        error
	cursor     int
	mode       mode
	pullInput  string // text input for pull mode
	loading    bool
	showDims    bool
	showChunks  bool
	focus       panel          // which panel has focus
	chunks      []ol.ChunkItem // chunks for current view
	chunkCounts ol.ChunkCounts
	history     *nav.History
	navLevel    navLevel
	side        memberSide // instance or relates when inside an element
	subCursor   int        // cursor for sub-items inside an element
	scrollOff    int   // line offset for scrolling the dims panel
	entryStart   []int // line offsets per dim entry (computed in Update)
	entryEnd     []int
	totalLines   int
	chunkCursor  int   // cursor within chunks panel
	branch      string       // current active branch
	branches    []ol.Branch  // cached branch list for picker
	dimSums      *summary.DimSummaries // cached dim summaries (scope-independent)
	scopeSum     summary.Summary       // current scope summary
	dimsLoading  bool                  // dim summaries being fetched
	scopeLoading bool                  // scope summary being fetched
	summaryCache *summary.Cache
	longSummary  bool
}

// scopeMsg carries the result of an async scope fetch.
type scopeMsg struct {
	resp *ol.ScopeResponse
	err  error
}

// chunksMsg carries the result of an async chunks fetch.
type chunksMsg struct {
	items  []ol.ChunkItem
	counts ol.ChunkCounts
	err    error
}

// dimSumsMsg carries dim summaries (generated once per HEAD).
type dimSumsMsg struct {
	result *summary.DimSummaries
	head   string
	err    error
}

// scopeSumMsg carries a scope summary.
type scopeSumMsg struct {
	result summary.Summary
	key    string
	err    error
}

// branchListMsg carries the result of an async branch list fetch.
type branchListMsg struct {
	branches []ol.Branch
	err      error
}

// branchSwitchedMsg signals a branch switch completed.
type branchSwitchedMsg struct {
	err error
}

// clientReadyMsg is sent once the system is discovered.
type clientReadyMsg struct {
	client    *ol.Client
	resp      *ol.ScopeResponse
	err       error
	branch    string
	systemDir string
}

func newModel() model {
	return model{
		showDims:   true,
		showChunks: true,
	}
}

func (m model) Init() tea.Cmd {
	return func() tea.Msg {
		systemDir, err := findSystem(".")
		if err != nil {
			return clientReadyMsg{err: err}
		}
		client := &ol.Client{DBPath: dbPath(systemDir)}
		resp, err := client.Scope()
		return clientReadyMsg{client: client, resp: resp, err: err, branch: activeBranch(systemDir), systemDir: systemDir}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.adjustScroll()

	case clientReadyMsg:
		m.loading = false
		if msg.err != nil {
			m.err = msg.err
			return m, nil
		}
		m.client = msg.client
		m.branch = msg.branch
		m.summaryCache = summary.NewCache(msg.systemDir)
		m.scope = msg.resp
		m.cursor = -1
		m.scrollOff = 0
		m.history = nav.NewHistory(msg.resp.Scope)
		m.adjustScroll()
		var cmds []tea.Cmd
		if m.showChunks {
			cmds = append(cmds, m.fetchChunksCmd())
		}
		if cmd := m.fetchDimSumsCmd(); cmd != nil {
			cmds = append(cmds, cmd)
		}
		if cmd := m.fetchScopeSumCmd(); cmd != nil {
			cmds = append(cmds, cmd)
		}
		if len(cmds) > 0 {
			return m, tea.Batch(cmds...)
		}

	case scopeMsg:
		m.loading = false
		if msg.err != nil {
			m.err = msg.err
			return m, nil
		}
		m.scope = msg.resp
		m.cursor = -1
		m.scrollOff = 0
		m.chunks = nil
		m.adjustScroll()
		var cmds []tea.Cmd
		if m.showChunks {
			cmds = append(cmds, m.fetchChunksCmd())
		}
		// Dim summaries reuse cache (keyed by HEAD, not scope)
		if cmd := m.fetchDimSumsCmd(); cmd != nil {
			cmds = append(cmds, cmd)
		}
		// Scope summary is per-scope
		if cmd := m.fetchScopeSumCmd(); cmd != nil {
			cmds = append(cmds, cmd)
		}
		if len(cmds) > 0 {
			return m, tea.Batch(cmds...)
		}

	case chunksMsg:
		if msg.err == nil {
			m.chunks = msg.items
			m.chunkCounts = msg.counts
			m.chunkCursor = 0
		}

	case dimSumsMsg:
		m.dimsLoading = false
		if msg.err == nil {
			m.dimSums = msg.result
			m.summaryCache.SetDims(msg.head, msg.result)
		}

	case scopeSumMsg:
		m.scopeLoading = false
		if msg.err == nil {
			m.scopeSum = msg.result
			m.summaryCache.SetScope(msg.key, msg.result)
		}

	case branchListMsg:
		if msg.err == nil {
			m.branches = msg.branches
			m.mode = modeBranch
		}

	case branchSwitchedMsg:
		if msg.err == nil {
			// Reload scope on new branch
			return m, func() tea.Msg {
				resp, err := m.client.Scope()
				return scopeMsg{resp: resp, err: err}
			}
		}

	case tea.KeyMsg:
		if m.err != nil {
			return m, tea.Quit
		}

		switch m.mode {
		case modeDrop:
			return m.updateDrop(msg)
		case modePull:
			return m.updatePull(msg)
		case modeBranch:
			return m.updateBranch(msg)
		case modeToggle:
			return m.updateToggle(msg)
		default:
			return m.updateNormal(msg)
		}
	}
	return m, nil
}

func (m model) updateNormal(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Tab switches focus between panels
	if msg.String() == "tab" && m.showDims && m.showChunks {
		if m.focus == panelDims {
			m.focus = panelChunks
			m.chunkCursor = 0
		} else {
			m.focus = panelDims
		}
		return m, nil
	}

	// When chunks panel has focus, handle j/k there
	if m.focus == panelChunks {
		return m.updateChunksFocus(msg)
	}

	switch m.navLevel {
	case levelInsideDim:
		return m.updateInsideDim(msg)
	case levelInsideChunk:
		return m.updateInsideChunk(msg)
	}
	return m.updateEntryLevel(msg)
}

func (m model) updateEntryLevel(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "j", "down":
		if m.scope != nil && m.cursor < len(m.scope.Dimensions)-1 {
			m.cursor++
			m.adjustScroll()
			if m.showChunks {
				return m, m.fetchChunksCmd()
			}
		}
	case "k", "up":
		if m.cursor >= -1 {
			m.cursor--
			if m.cursor < -1 {
				m.cursor = -1
			}
			m.adjustScroll()
			if m.showChunks {
				return m, m.fetchChunksCmd()
			}
		}
	case "l", "right":
		// Enter the focused element (only when on a dim, not scope level)
		if m.focus == panelDims && m.scope != nil && m.cursor >= 0 && m.cursor < len(m.scope.Dimensions) {
			m.navLevel = levelInsideDim
			m.side = sideInstance
			m.subCursor = 0
		}
	case "a":
		return m.addFocusedDim()
	case "d":
		if m.scope != nil && len(m.scope.Scope) > 0 {
			m.mode = modeDrop
		}
	case "p":
		m.mode = modePull
		m.pullInput = ""
	case "b":
		// Fetch branch list, then enter branch picker
		client := m.client
		if client != nil {
			return m, func() tea.Msg {
				branches, err := client.BranchList()
				return branchListMsg{branches: branches, err: err}
			}
		}
	case "u":
		if m.history != nil && m.history.CanUndo() {
			scope := m.history.Undo()
			return m.fetchScopeNoHistory(scope)
		}
	case "r":
		if m.history != nil && m.history.CanRedo() {
			scope := m.history.Redo()
			return m.fetchScopeNoHistory(scope)
		}
	case "t":
		m.mode = modeToggle
	}
	return m, nil
}

func (m model) updateInsideDim(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	dim := m.scope.Dimensions[m.cursor]
	subItems := m.subItemsForDim(dim)

	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "h", "left":
		if m.side == sideRelates {
			m.side = sideInstance
		} else {
			// At instance (leftmost) — exit to entry level
			m.navLevel = levelEntry
			m.subCursor = 0
		}
	case "l", "right":
		if m.side == sideInstance {
			m.side = sideRelates
		}
	case "j", "down":
		if m.subCursor < len(subItems)-1 {
			m.subCursor++
		}
	case "k", "up":
		if m.subCursor > 0 {
			m.subCursor--
		}
	case "a":
		// Add focused sub-dim to scope
		if m.subCursor < len(subItems) {
			dimName := subItems[m.subCursor]
			for _, s := range m.scope.Scope {
				if s == dimName {
					return m, nil
				}
			}
			newScope := append(append([]string{}, m.scope.Scope...), dimName)
			m.navLevel = levelEntry
			m.subCursor = 0
			return m.fetchScope(newScope)
		}
	}
	return m, nil
}

func (m model) updateInsideChunk(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if m.chunks == nil || m.cursor >= len(m.chunks) {
		m.navLevel = levelEntry
		return m, nil
	}
	chunk := m.chunks[m.cursor]
	subItems := m.subItemsForChunk(chunk)

	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "h", "left":
		if m.side == sideRelates {
			m.side = sideInstance
		} else {
			m.navLevel = levelEntry
			m.subCursor = 0
		}
	case "l", "right":
		if m.side == sideInstance {
			m.side = sideRelates
		}
	case "j", "down":
		if m.subCursor < len(subItems)-1 {
			m.subCursor++
		}
	case "k", "up":
		if m.subCursor > 0 {
			m.subCursor--
		}
	case "a":
		if m.subCursor < len(subItems) {
			dimName := subItems[m.subCursor]
			for _, s := range m.scope.Scope {
				if s == dimName {
					return m, nil
				}
			}
			newScope := append(append([]string{}, m.scope.Scope...), dimName)
			m.navLevel = levelEntry
			m.subCursor = 0
			return m.fetchScope(newScope)
		}
	}
	return m, nil
}

// subItemsForDim returns the navigable sub-items for a dim entry (connections + edges).
func (m model) subItemsForDim(dim ol.ScopeDim) []string {
	var items []string
	for _, c := range dim.Connections {
		items = append(items, c.Dim)
	}
	for _, e := range dim.Edges {
		items = append(items, e.Dim)
	}
	return items
}

// subItemsForChunk returns the navigable membership dims for a chunk.
func (m model) subItemsForChunk(chunk ol.ChunkItem) []string {
	if m.side == sideInstance {
		return chunk.Instance
	}
	return chunk.Relates
}

func (m model) updateDrop(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()
	if len(key) == 1 && key[0] >= '0' && key[0] <= '9' {
		idx := int(key[0] - '0')
		if idx == 0 {
			idx = len(m.scope.Scope) - 1
		} else {
			idx--
		}
		if idx >= 0 && idx < len(m.scope.Scope) {
			newScope := make([]string, 0, len(m.scope.Scope)-1)
			for i, d := range m.scope.Scope {
				if i != idx {
					newScope = append(newScope, d)
				}
			}
			m.mode = modeNormal
			return m.fetchScope(newScope)
		}
	}
	m.mode = modeNormal
	return m, nil
}

func (m model) updatePull(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEscape:
		m.mode = modeNormal
		m.pullInput = ""
		return m, nil
	case tea.KeyEnter:
		if m.pullInput != "" {
			newScope := append(append([]string{}, m.scope.Scope...), m.pullInput)
			m.mode = modeNormal
			m.pullInput = ""
			return m.fetchScope(newScope)
		}
		m.mode = modeNormal
		return m, nil
	case tea.KeyBackspace:
		if len(m.pullInput) > 0 {
			m.pullInput = m.pullInput[:len(m.pullInput)-1]
		}
		return m, nil
	default:
		if msg.Type == tea.KeyRunes {
			m.pullInput += string(msg.Runes)
		}
		return m, nil
	}
}

func (m model) updateToggle(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	m.mode = modeNormal
	switch msg.String() {
	case "d":
		m.showDims = !m.showDims
		if !m.showDims && m.focus == panelDims {
			m.focus = panelChunks
		}
		m.adjustScroll()
	case "c":
		m.showChunks = !m.showChunks
		if m.showChunks && m.chunks == nil {
			return m, m.fetchChunksCmd()
		}
		if !m.showChunks && m.focus == panelChunks {
			m.focus = panelDims
		}
	case "s":
		m.longSummary = !m.longSummary
		m.adjustScroll()
	}
	return m, nil
}

func (m model) updateChunksFocus(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "j", "down":
		if m.chunks != nil && m.chunkCursor < len(m.chunks)-1 {
			m.chunkCursor++
		}
	case "k", "up":
		if m.chunkCursor > 0 {
			m.chunkCursor--
		}
	}
	return m, nil
}

func (m model) updateBranch(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()
	if len(key) == 1 && key[0] >= '1' && key[0] <= '9' {
		idx := int(key[0]-'1')
		if idx < len(m.branches) {
			target := m.branches[idx].Name
			if target == m.branch {
				m.mode = modeNormal
				return m, nil
			}
			m.mode = modeNormal
			m.branch = target
			client := m.client
			return m, func() tea.Msg {
				if err := client.BranchSwitch(target); err != nil {
					return branchSwitchedMsg{err: err}
				}
				return branchSwitchedMsg{}
			}
		}
	}
	m.mode = modeNormal
	return m, nil
}

func (m model) addFocusedDim() (tea.Model, tea.Cmd) {
	if m.scope == nil || m.cursor < 0 || m.cursor >= len(m.scope.Dimensions) {
		return m, nil
	}
	dimName := m.scope.Dimensions[m.cursor].Name
	for _, s := range m.scope.Scope {
		if s == dimName {
			return m, nil
		}
	}
	newScope := append(append([]string{}, m.scope.Scope...), dimName)
	return m.fetchScope(newScope)
}

func (m model) fetchScope(dims []string) (tea.Model, tea.Cmd) {
	m.loading = true
	if m.history != nil {
		m.history.Push(dims)
	}
	client := m.client
	return m, func() tea.Msg {
		if client == nil {
			return scopeMsg{err: nil}
		}
		resp, err := client.Scope(dims...)
		return scopeMsg{resp: resp, err: err}
	}
}

// fetchScopeNoHistory fetches a scope without pushing to history (for undo/redo).
func (m model) fetchScopeNoHistory(dims []string) (tea.Model, tea.Cmd) {
	m.loading = true
	client := m.client
	return m, func() tea.Msg {
		if client == nil {
			return scopeMsg{err: nil}
		}
		resp, err := client.Scope(dims...)
		return scopeMsg{resp: resp, err: err}
	}
}

// fetchChunksCmd returns a command that fetches chunks for the current view.
// At scope level (cursor -1): all in-scope chunks.
// On a dim (cursor >= 0): scope ∩ that dim.
func (m model) fetchChunksCmd() tea.Cmd {
	client := m.client
	if client == nil {
		return nil
	}
	dims := append([]string{}, m.scope.Scope...)
	if m.cursor >= 0 && m.cursor < len(m.scope.Dimensions) {
		dims = append(dims, m.scope.Dimensions[m.cursor].Name)
	}
	return func() tea.Msg {
		resp, err := client.ScopeWithChunks(dims...)
		if err != nil {
			return chunksMsg{err: err}
		}
		return chunksMsg{items: resp.Chunks.Items, counts: resp.Chunks}
	}
}

// adjustScroll recomputes entry positions and adjusts scrollOff
// so the cursor entry is visible. Must be called after any cursor change.
// fetchDimSumsCmd fetches dim summaries (once per HEAD, reused across scopes).
func (m *model) fetchDimSumsCmd() tea.Cmd {
	if m.client == nil || m.scope == nil || m.summaryCache == nil {
		return nil
	}
	head := m.scope.Head
	if cached, ok := m.summaryCache.GetDims(head); ok {
		m.dimSums = cached
		m.dimsLoading = false
		return nil
	}
	m.dimsLoading = true
	client := m.client
	// Get ALL dims from root scope for complete coverage
	return func() tea.Msg {
		rootResp, err := client.Scope()
		if err != nil {
			return dimSumsMsg{err: err}
		}
		var allDims []string
		for _, d := range rootResp.Dimensions {
			allDims = append(allDims, d.Name)
		}
		result, err := summary.GenerateDims(client, allDims)
		return dimSumsMsg{result: result, head: head, err: err}
	}
}

// fetchScopeSumCmd fetches a scope-level summary (per scope+head).
func (m *model) fetchScopeSumCmd() tea.Cmd {
	if m.client == nil || m.scope == nil || m.summaryCache == nil {
		return nil
	}
	key := summary.ScopeKey(m.scope.Scope, m.scope.Head)
	if cached, ok := m.summaryCache.GetScope(key); ok {
		m.scopeSum = cached
		m.scopeLoading = false
		return nil
	}
	m.scopeLoading = true
	m.scopeSum = summary.Summary{}
	client := m.client
	scope := append([]string{}, m.scope.Scope...)
	return func() tea.Msg {
		result, err := summary.GenerateScope(client, scope)
		return scopeSumMsg{result: result, key: key, err: err}
	}
}

func (m *model) adjustScroll() {
	if m.scope == nil || m.width == 0 {
		return
	}
	r := ui.RenderDimsList(m.scope.Dimensions, m.cursor, m.insideState(), m.dimsMaxWidth(), m.dimSummaries(), m.scopeSummaryOpts())
	m.entryStart = r.EntryStart
	m.entryEnd = r.EntryEnd
	m.totalLines = r.TotalLines

	viewH := m.contentHeight()
	if viewH <= 0 || m.totalLines <= viewH {
		m.scrollOff = 0
		return
	}

	start := 0
	end := m.totalLines - 1
	// Entry 0 = scope summary, entry 1+ = dims. cursor -1 maps to entry 0.
	idx := m.cursor + 1
	if idx >= 0 && idx < len(m.entryStart) {
		start = m.entryStart[idx]
		end = m.entryEnd[idx]
	}

	if start < m.scrollOff {
		m.scrollOff = start
	} else if end >= m.scrollOff+viewH {
		m.scrollOff = end - viewH + 1
	}

	if m.scrollOff < 0 {
		m.scrollOff = 0
	}
	if max := m.totalLines - viewH; m.scrollOff > max {
		m.scrollOff = max
	}
}


func (m model) View() string {
	if m.width == 0 {
		return ""
	}

	if m.err != nil {
		return "\n " + ui.Dim.Render(m.err.Error()) + "\n\n " + ui.Dim.Render("press any key to quit") + "\n"
	}

	if m.scope == nil {
		return "\n " + ui.Dim.Render("loading...") + "\n"
	}

	// Fixed top bar + blank line below
	top := ui.TopBar(m.scope, m.branch) + "\n\n"

	// Scrollable content
	var content string
	if !m.showDims && !m.showChunks {
		content = "\n " + ui.Dim.Render("Press t to toggle a panel.")
	} else if m.loading {
		content = "\n " + ui.Dim.Render("loading...")
	} else if m.showDims && m.showChunks {
		content = m.viewSplit()
	} else if m.showChunks {
		content = m.viewChunksOnly()
	} else {
		content = m.viewDimsOnly()
	}

	// Build fixed-height output: top + content + bottom = exactly m.height lines
	// top = 2 lines (topbar + blank), bottom = 2 lines (blank + bottombar)
	bottom := m.bottomBar()
	viewH := m.contentHeight()

	contentLines := strings.Split(content, "\n")
	for len(contentLines) < viewH {
		contentLines = append(contentLines, "")
	}
	if len(contentLines) > viewH {
		contentLines = contentLines[:viewH]
	}

	return top + strings.Join(contentLines, "\n") + "\n\n" + bottom
}

// panelWidth returns the width for each panel (equal split).
func (m model) panelWidth() int {
	return ui.PanelWidth(m.width)
}

// dimsMaxWidth returns the max visible width for the dims panel.
func (m model) dimsMaxWidth() int {
	return m.panelWidth()
}

// contentHeight returns the available lines between top bar and bottom bar.
func (m model) contentHeight() int {
	// top line (1) + top blank (1) + bottom blank (1) + bottom line (1)
	return m.height - 4
}

func (m model) viewDimsOnly() string {
	r := ui.RenderDimsList(m.scope.Dimensions, m.cursor, m.insideState(), m.dimsMaxWidth(), m.dimSummaries(), m.scopeSummaryOpts())
	return m.clipToViewport(r.Content)
}

// chunksMaxWidth returns the available width for the chunks panel.
func (m model) chunksMaxWidth() int {
	if m.showDims {
		return m.panelWidth()
	}
	return m.width
}

func (m model) viewChunksOnly() string {
	if m.chunks == nil {
		return ui.Dim.Render(" loading chunks...")
	}
	return ui.RenderChunksList(m.chunks, m.chunkCounts, m.chunksMaxWidth(), m.activeChunkCursor())
}

func (m model) viewSplit() string {
	r := ui.RenderDimsList(m.scope.Dimensions, m.cursor, m.insideState(), m.dimsMaxWidth(), m.dimSummaries(), m.scopeSummaryOpts())
	left := m.clipToViewport(r.Content)
	var right string
	if m.chunks == nil {
		right = ui.Dim.Render("loading chunks...")
	} else {
		right = ui.RenderChunksList(m.chunks, m.chunkCounts, m.chunksMaxWidth(), m.activeChunkCursor())
	}
	right = clipLines(right, m.contentHeight())
	return ui.MergePanels(left, right, m.panelWidth())
}

// clipLines truncates content to maxLines.
func clipLines(content string, maxLines int) string {
	if maxLines <= 0 {
		return ""
	}
	lines := strings.Split(content, "\n")
	if len(lines) <= maxLines {
		return content
	}
	return strings.Join(lines[:maxLines], "\n")
}


// clipToViewport clips rendered content to the visible area using pre-computed scrollOff.
func (m model) clipToViewport(content string) string {
	lines := strings.Split(content, "\n")
	viewH := m.contentHeight()
	if viewH <= 0 || len(lines) <= viewH {
		return content
	}
	off := m.scrollOff
	if off+viewH > len(lines) {
		off = len(lines) - viewH
	}
	if off < 0 {
		off = 0
	}
	return strings.Join(lines[off:off+viewH], "\n")
}

func (m model) scopeSummaryOpts() ui.ScopeSummaryOpts {
	if m.scopeLoading {
		return ui.ScopeSummaryOpts{Loading: true, Selected: m.cursor == -1}
	}
	return ui.ScopeSummaryOpts{
		Short:    m.scopeSum.Short,
		Long:     m.scopeSum.Long,
		ShowLong: m.longSummary,
		Selected: m.cursor == -1,
	}
}

func (m model) activeChunkCursor() int {
	if m.focus == panelChunks {
		return m.chunkCursor
	}
	return -1
}

func (m model) dimSummaries() map[string]string {
	if m.dimSums == nil {
		return nil
	}
	out := make(map[string]string, len(m.dimSums.Dims))
	for k, v := range m.dimSums.Dims {
		if m.longSummary && v.Long != "" {
			out[k] = v.Short + "\n" + v.Long
		} else {
			out[k] = v.Short
		}
	}
	return out
}

func (m model) insideState() *ui.InsideState {
	if m.navLevel == levelInsideDim {
		side := 0
		if m.side == sideRelates {
			side = 1
		}
		return &ui.InsideState{Active: true, Side: side, SubCursor: m.subCursor}
	}
	return nil
}

func (m model) bottomBar() string {
	switch m.mode {
	case modeDrop:
		return ui.DropBar(m.scope.Scope)
	case modePull:
		return ui.PullBar(m.pullInput)
	case modeBranch:
		return ui.BranchBar(m.branches, m.branch)
	case modeToggle:
		return ui.ToggleBar()
	default:
		return ui.BottomBar()
	}
}
