const std = @import("std");
const sqlite = @import("sqlite.zig");

const Db = @This();

pub const Error = sqlite.Error;
pub const Statement = sqlite.Statement;

conn: sqlite,

pub fn open(path: [*:0]const u8) Error!Db {
    return .{ .conn = try sqlite.open(path) };
}

pub fn close(self: *Db) void {
    self.conn.close();
}

pub fn exec(self: *Db, sql: [*:0]const u8) Error!void {
    try self.conn.exec(sql);
}

pub fn prepare(self: *Db, sql: [*:0]const u8) Error!Statement {
    return try self.conn.prepare(sql);
}

// -- Schema --

const schema_sql =
    \\CREATE TABLE IF NOT EXISTS commits (
    \\    id TEXT PRIMARY KEY,
    \\    parent_id TEXT,
    \\    timestamp TEXT NOT NULL
    \\);
    \\
    \\CREATE TABLE IF NOT EXISTS branches (
    \\    name TEXT PRIMARY KEY,
    \\    head TEXT NOT NULL REFERENCES commits(id)
    \\);
    \\
    \\CREATE TABLE IF NOT EXISTS chunk_versions (
    \\    chunk_id TEXT NOT NULL,
    \\    commit_id TEXT NOT NULL REFERENCES commits(id),
    \\    text TEXT NOT NULL,
    \\    kv TEXT DEFAULT '{}',
    \\    removed INTEGER DEFAULT 0,
    \\    PRIMARY KEY (chunk_id, commit_id)
    \\);
    \\
    \\CREATE TABLE IF NOT EXISTS membership_versions (
    \\    chunk_id TEXT NOT NULL,
    \\    dimension TEXT NOT NULL,
    \\    type TEXT NOT NULL CHECK (type IN ('instance', 'relates')),
    \\    active INTEGER NOT NULL DEFAULT 1,
    \\    commit_id TEXT NOT NULL REFERENCES commits(id),
    \\    PRIMARY KEY (chunk_id, dimension, commit_id)
    \\);
    \\
    \\CREATE INDEX IF NOT EXISTS idx_mv_dimension ON membership_versions(dimension, type);
    \\CREATE INDEX IF NOT EXISTS idx_mv_chunk ON membership_versions(chunk_id);
    \\CREATE INDEX IF NOT EXISTS idx_cv_chunk ON chunk_versions(chunk_id, commit_id);
    \\
    \\CREATE TABLE IF NOT EXISTS meta (
    \\    key TEXT PRIMARY KEY,
    \\    value TEXT NOT NULL
    \\);
;

pub fn initSchema(self: *Db) Error!void {
    try self.exec(schema_sql);
}

// -- Utilities --

pub fn generateId() [20]u8 {
    var buf: [20]u8 = undefined;
    var random_bytes: [20]u8 = undefined;
    std.crypto.random.bytes(&random_bytes);
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (&buf, random_bytes) |*b, r| {
        b.* = chars[r % chars.len];
    }
    return buf;
}

fn getTimestamp(buf: []u8) []const u8 {
    const epoch_secs = std.time.timestamp();
    const epoch: std.time.epoch.EpochSeconds = .{ .secs = @intCast(epoch_secs) };
    const epoch_day = epoch.getEpochDay();
    const year_day = epoch_day.calculateYearDay();
    const month_day = year_day.calculateMonthDay();
    const day_secs = epoch.getDaySeconds();

    return std.fmt.bufPrint(buf, "{d:0>4}-{d:0>2}-{d:0>2}T{d:0>2}:{d:0>2}:{d:0>2}Z", .{
        year_day.year,
        month_day.month.numeric(),
        month_day.day_index + 1,
        day_secs.getHoursIntoDay(),
        day_secs.getMinutesIntoHour(),
        day_secs.getSecondsIntoMinute(),
    }) catch "1970-01-01T00:00:00Z";
}

// -- Meta --

pub fn getActiveBranch(self: *Db, allocator: std.mem.Allocator) Error![]const u8 {
    var stmt = try self.prepare("SELECT value FROM meta WHERE key = 'active_branch'");
    defer stmt.finalize();
    if (try stmt.step()) {
        const val = stmt.columnText(0) orelse return allocator.dupe(u8, "main") catch return error.OutOfMemory;
        return allocator.dupe(u8, val) catch return error.OutOfMemory;
    }
    return allocator.dupe(u8, "main") catch return error.OutOfMemory;
}

fn setActiveBranch(self: *Db, name: []const u8) Error!void {
    var stmt = try self.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_branch', ?1)");
    defer stmt.finalize();
    try stmt.bindSlice(1, name);
    _ = try stmt.step();
}

// -- Init --

pub fn createRootCommit(self: *Db) Error![20]u8 {
    const id = generateId();

    var ts_buf: [30]u8 = undefined;
    const timestamp = getTimestamp(&ts_buf);

    var stmt = try self.prepare("INSERT INTO commits (id, parent_id, timestamp) VALUES (?1, NULL, ?2)");
    defer stmt.finalize();
    try stmt.bindSlice(1, &id);
    try stmt.bindSlice(2, timestamp);
    _ = try stmt.step();

    var branch_stmt = try self.prepare("INSERT INTO branches (name, head) VALUES ('main', ?1)");
    defer branch_stmt.finalize();
    try branch_stmt.bindSlice(1, &id);
    _ = try branch_stmt.step();

    try self.setActiveBranch("main");

    return id;
}

// -- Apply --

/// Get the HEAD commit id for the given branch (default: "main")
pub fn getBranchHead(self: *Db, branch: []const u8) Error!?[20]u8 {
    var stmt = try self.prepare("SELECT head FROM branches WHERE name = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, branch);
    if (try stmt.step()) {
        const head_text = stmt.columnText(0) orelse return null;
        if (head_text.len != 20) return null;
        var result: [20]u8 = undefined;
        @memcpy(&result, head_text[0..20]);
        return result;
    }
    return null;
}

/// Create a new commit with the given parent
fn createCommit(self: *Db, parent_id: []const u8) Error![20]u8 {
    const id = generateId();
    var ts_buf: [30]u8 = undefined;
    const timestamp = getTimestamp(&ts_buf);

    var stmt = try self.prepare("INSERT INTO commits (id, parent_id, timestamp) VALUES (?1, ?2, ?3)");
    defer stmt.finalize();
    try stmt.bindSlice(1, &id);
    try stmt.bindSlice(2, parent_id);
    try stmt.bindSlice(3, timestamp);
    _ = try stmt.step();

    return id;
}

/// Advance branch HEAD to a new commit
fn advanceBranch(self: *Db, branch: []const u8, commit_id: []const u8) Error!void {
    var stmt = try self.prepare("UPDATE branches SET head = ?1 WHERE name = ?2");
    defer stmt.finalize();
    try stmt.bindSlice(1, commit_id);
    try stmt.bindSlice(2, branch);
    _ = try stmt.step();
}

/// Insert a chunk_versions row
fn insertChunkVersion(self: *Db, chunk_id: []const u8, commit_id: []const u8, text: []const u8, kv: []const u8, removed: bool) Error!void {
    var stmt = try self.prepare("INSERT INTO chunk_versions (chunk_id, commit_id, text, kv, removed) VALUES (?1, ?2, ?3, ?4, ?5)");
    defer stmt.finalize();
    try stmt.bindSlice(1, chunk_id);
    try stmt.bindSlice(2, commit_id);
    try stmt.bindSlice(3, text);
    try stmt.bindSlice(4, kv);
    try stmt.bindInt(5, if (removed) 1 else 0);
    _ = try stmt.step();
}

/// Serialize a JSON object value to a kv string. Caller owns returned memory.
fn serializeKv(allocator: std.mem.Allocator, kv_val: std.json.Value) Error!?[]const u8 {
    if (kv_val != .object) return null;
    return std.json.Stringify.valueAlloc(allocator, kv_val, .{}) catch return error.OutOfMemory;
}

/// Insert a membership_versions row
fn insertMembership(self: *Db, chunk_id: []const u8, dimension: []const u8, mem_type: []const u8, active: bool, commit_id: []const u8) Error!void {
    var stmt = try self.prepare("INSERT INTO membership_versions (chunk_id, dimension, type, active, commit_id) VALUES (?1, ?2, ?3, ?4, ?5)");
    defer stmt.finalize();
    try stmt.bindSlice(1, chunk_id);
    try stmt.bindSlice(2, dimension);
    try stmt.bindSlice(3, mem_type);
    try stmt.bindInt(4, if (active) 1 else 0);
    try stmt.bindSlice(5, commit_id);
    _ = try stmt.step();
}

/// Apply a declarative JSON mutation. Returns the new commit ID.
/// JSON format: {"chunks": [{"text": "...", "instance": [...], "relates": [...], "kv": {...}}, ...]}
pub fn apply(self: *Db, allocator: std.mem.Allocator, json_input: []const u8) Error!ApplyResult {
    const parsed = std.json.parseFromSlice(std.json.Value, allocator, json_input, .{}) catch return error.InvalidInput;
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) return error.InvalidInput;

    const chunks_val = root.object.get("chunks") orelse return error.InvalidInput;
    if (chunks_val != .array) return error.InvalidInput;

    // Begin transaction
    try self.exec("BEGIN IMMEDIATE");
    errdefer self.exec("ROLLBACK") catch {};

    // Get active branch and its HEAD
    const branch = try self.getActiveBranch(allocator);
    defer allocator.free(branch);
    const parent_id = try self.getBranchHead(branch) orelse return error.SqliteError;

    // Create new commit
    const commit_id = try self.createCommit(&parent_id);

    // Track created chunk IDs for the response
    var created_ids: std.ArrayListAligned([20]u8, null) = .{};
    defer created_ids.deinit(allocator);

    // Process each chunk in the mutation
    for (chunks_val.array.items) |chunk_val| {
        if (chunk_val != .object) return error.InvalidInput;
        const chunk = chunk_val.object;

        const has_id = chunk.get("id");
        const is_removed = if (chunk.get("removed")) |r| r == .bool and r.bool else false;

        if (is_removed) {
            // Remove chunk — needs an existing id
            const existing_id = if (has_id) |id_val| (if (id_val == .string) id_val.string else null) else null;
            if (existing_id == null) return error.InvalidInput;
            try self.insertChunkVersion(existing_id.?, &commit_id, "", "{}", true);
        } else if (has_id) |id_val| {
            // Update existing chunk
            const chunk_id = if (id_val == .string) id_val.string else return error.InvalidInput;

            // Check if text or kv changed
            const new_text = if (chunk.get("text")) |t| (if (t == .string) t.string else null) else null;
            const kv_owned = if (chunk.get("kv")) |kv_val| try serializeKv(allocator, kv_val) else null;
            defer if (kv_owned) |owned| allocator.free(owned);
            const new_kv: ?[]const u8 = kv_owned;

            // If text or kv provided, insert new chunk_versions row
            if (new_text != null or new_kv != null) {
                // Get current text/kv to fill in unchanged fields
                var cur = try self.prepare(
                    "SELECT text, kv FROM chunk_versions WHERE chunk_id = ?1 ORDER BY rowid DESC LIMIT 1",
                );
                defer cur.finalize();
                try cur.bindSlice(1, chunk_id);
                if (try cur.step()) {
                    const cur_text = cur.columnText(0) orelse "";
                    const cur_kv = cur.columnText(1) orelse "{}";
                    try self.insertChunkVersion(
                        chunk_id,
                        &commit_id,
                        new_text orelse cur_text,
                        new_kv orelse cur_kv,
                        false,
                    );
                }
            }

            // If instance/relates provided, compute membership diff
            const new_instance = if (chunk.get("instance")) |v| (if (v == .array) v.array.items else null) else null;
            const new_relates = if (chunk.get("relates")) |v| (if (v == .array) v.array.items else null) else null;

            if (new_instance != null or new_relates != null) {
                // Get current memberships
                var cur_mem = try self.prepare(
                    \\SELECT dimension, type FROM membership_versions
                    \\WHERE chunk_id = ?1 AND rowid IN (
                    \\  SELECT MAX(rowid) FROM membership_versions WHERE chunk_id = ?1 GROUP BY dimension
                    \\) AND active = 1
                );
                defer cur_mem.finalize();
                try cur_mem.bindSlice(1, chunk_id);

                var old_instance = std.StringHashMap(void).init(allocator);
                defer old_instance.deinit();
                var old_relates = std.StringHashMap(void).init(allocator);
                defer old_relates.deinit();

                while (try cur_mem.step()) {
                    const dim = cur_mem.columnText(0) orelse continue;
                    const mtype = cur_mem.columnText(1) orelse continue;
                    const dim_copy = allocator.dupe(u8, dim) catch return error.OutOfMemory;
                    if (std.mem.eql(u8, mtype, "instance")) {
                        old_instance.put(dim_copy, {}) catch return error.OutOfMemory;
                    } else {
                        old_relates.put(dim_copy, {}) catch return error.OutOfMemory;
                    }
                }
                defer {
                    var it1 = old_instance.keyIterator();
                    while (it1.next()) |k| allocator.free(k.*);
                    var it2 = old_relates.keyIterator();
                    while (it2.next()) |k| allocator.free(k.*);
                }

                // Process new instance memberships
                if (new_instance) |dims| {
                    for (dims) |dim_val| {
                        if (dim_val != .string) return error.InvalidInput;
                        const dim = dim_val.string;

                        if (old_instance.contains(dim)) {
                            // Already instance — no change needed
                        } else if (old_relates.contains(dim)) {
                            // Was relates, now instance — type change
                            try self.insertMembership(chunk_id, dim, "instance", true, &commit_id);
                        } else {
                            // New membership
                            try self.insertMembership(chunk_id, dim, "instance", true, &commit_id);
                        }
                    }
                    // Deactivate removed instance memberships
                    var oi = old_instance.keyIterator();
                    while (oi.next()) |key| {
                        var still_present = false;
                        for (dims) |dim_val| {
                            if (dim_val == .string and std.mem.eql(u8, dim_val.string, key.*)) {
                                still_present = true;
                                break;
                            }
                        }
                        // Only deactivate if not already handled by relates (type change)
                        if (!still_present) {
                            const in_new_relates = if (new_relates) |rel| blk: {
                                for (rel) |rv| {
                                    if (rv == .string and std.mem.eql(u8, rv.string, key.*)) break :blk true;
                                }
                                break :blk false;
                            } else false;
                            if (!in_new_relates) {
                                try self.insertMembership(chunk_id, key.*, "instance", false, &commit_id);
                            }
                        }
                    }
                }

                if (new_relates) |dims| {
                    for (dims) |dim_val| {
                        if (dim_val != .string) return error.InvalidInput;
                        const dim = dim_val.string;

                        if (old_relates.contains(dim)) {
                            // Already relates — no change
                        } else if (old_instance.contains(dim)) {
                            // Was instance, now relates — type change
                            try self.insertMembership(chunk_id, dim, "relates", true, &commit_id);
                        } else {
                            // New membership
                            try self.insertMembership(chunk_id, dim, "relates", true, &commit_id);
                        }
                    }
                    var or_ = old_relates.keyIterator();
                    while (or_.next()) |key| {
                        var still_present = false;
                        for (dims) |dim_val| {
                            if (dim_val == .string and std.mem.eql(u8, dim_val.string, key.*)) {
                                still_present = true;
                                break;
                            }
                        }
                        // Only deactivate if not already handled by instance (type change)
                        if (!still_present) {
                            const in_new_instance = if (new_instance) |inst| blk: {
                                for (inst) |iv| {
                                    if (iv == .string and std.mem.eql(u8, iv.string, key.*)) break :blk true;
                                }
                                break :blk false;
                            } else false;
                            if (!in_new_instance) {
                                try self.insertMembership(chunk_id, key.*, "relates", false, &commit_id);
                            }
                        }
                    }
                }
            }
        } else {
            // New chunk
            const text = if (chunk.get("text")) |t| (if (t == .string) t.string else null) else null;
            if (text == null) return error.InvalidInput;

            // Extract kv as raw JSON string
            const kv_owned2 = if (chunk.get("kv")) |kv_val| try serializeKv(allocator, kv_val) else null;
            defer if (kv_owned2) |owned| allocator.free(owned);
            const kv_str: []const u8 = kv_owned2 orelse "{}";

            const instance_dims = if (chunk.get("instance")) |v| (if (v == .array) v.array.items else null) else null;
            const relates_dims = if (chunk.get("relates")) |v| (if (v == .array) v.array.items else null) else null;

            // Must have at least one membership
            const instance_count: usize = if (instance_dims) |d| d.len else 0;
            const relates_count: usize = if (relates_dims) |d| d.len else 0;
            if (instance_count + relates_count == 0) return error.InvalidInput;

            // Generate chunk ID
            const chunk_id = generateId();
            created_ids.append(allocator, chunk_id) catch return error.OutOfMemory;

            // Insert chunk version
            try self.insertChunkVersion(&chunk_id, &commit_id, text.?, kv_str, false);

            // Insert memberships and ensure dimensions
            if (instance_dims) |dims| {
                for (dims) |dim_val| {
                    if (dim_val != .string) return error.InvalidInput;

                    try self.insertMembership(&chunk_id, dim_val.string, "instance", true, &commit_id);
                }
            }
            if (relates_dims) |dims| {
                for (dims) |dim_val| {
                    if (dim_val != .string) return error.InvalidInput;

                    try self.insertMembership(&chunk_id, dim_val.string, "relates", true, &commit_id);
                }
            }
        }
    }

    // Advance branch HEAD
    try self.advanceBranch(branch, &commit_id);

    // Commit transaction
    try self.exec("COMMIT");

    return .{
        .commit_id = commit_id,
        .created_ids = created_ids.toOwnedSlice(allocator) catch return error.OutOfMemory,
    };
}

pub const ApplyResult = struct {
    commit_id: [20]u8,
    created_ids: [][20]u8,

    pub fn deinit(self: *ApplyResult, allocator: std.mem.Allocator) void {
        allocator.free(self.created_ids);
    }

    pub fn jsonStringify(self: *const ApplyResult, jw: anytype) !void {
        try jw.beginObject();
        try jw.objectField("commit");
        try jw.write(self.commit_id);
        try jw.objectField("created");
        try jw.beginArray();
        for (self.created_ids) |*id| {
            try jw.write(id.*);
        }
        try jw.endArray();
        try jw.endObject();
    }
};

// -- State Resolution --

/// The recursive CTE fragment used to walk commit ancestry from a HEAD.
/// Expects ?1 to be bound to the HEAD commit id.
const ancestry_cte =
    \\WITH RECURSIVE ancestry(id) AS (
    \\  SELECT ?1
    \\  UNION ALL
    \\  SELECT c.parent_id FROM commits c JOIN ancestry a ON c.id = a.id WHERE c.parent_id IS NOT NULL
    \\)
;

pub const DimInfo = struct {
    name: []const u8,
    instance: i32,
    relates: i32,
    total: i32,
};

/// List all dimensions with instance/relates/total counts on the current branch.
pub fn listDims(self: *Db, allocator: std.mem.Allocator) Error![]DimInfo {
    const branch = try self.getActiveBranch(allocator);
    defer allocator.free(branch);
    const head = try self.getBranchHead(branch) orelse return error.SqliteError;

    try self.materializeCurrentState(&head);
    defer self.dropCurrentState();

    var stmt = try self.prepare(
        \\SELECT dimension,
        \\  SUM(CASE WHEN type = 'instance' THEN 1 ELSE 0 END),
        \\  SUM(CASE WHEN type = 'relates' THEN 1 ELSE 0 END),
        \\  COUNT(*)
        \\FROM cur_memberships
        \\GROUP BY dimension ORDER BY dimension
    );
    defer stmt.finalize();

    var dims: std.ArrayListAligned(DimInfo, null) = .{};
    defer dims.deinit(allocator);

    while (try stmt.step()) {
        const name = stmt.columnText(0) orelse continue;
        dims.append(allocator, .{
            .name = allocator.dupe(u8, name) catch return error.OutOfMemory,
            .instance = stmt.columnInt(1),
            .relates = stmt.columnInt(2),
            .total = stmt.columnInt(3),
        }) catch return error.OutOfMemory;
    }

    return dims.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

pub fn freeDimInfos(allocator: std.mem.Allocator, dims: []DimInfo) void {
    for (dims) |dim| {
        allocator.free(dim.name);
    }
    allocator.free(dims);
}

// -- Scope --

pub const ScopeResult = struct {
    scope: []const []const u8,
    total_chunks: i32,
    in_scope: i32,
    in_scope_instance: i32,
    in_scope_relates: i32,
    dimensions: []ScopeDim,
    items: ?[]ChunkItem = null,

    pub const ScopeDim = struct {
        name: []const u8,
        shared: i32,
        instance: i32,
        relates: i32,
        connections: []Connection,
    };

    pub const Connection = struct {
        dim: []const u8,
        instance: i32,
        relates: i32,
    };

    pub const ChunkItem = struct {
        id: []const u8,
        text: []const u8,
        kv: []const u8,
        instance: []const []const u8,
        relates: []const []const u8,

        pub fn jsonStringify(self: *const ChunkItem, jw: anytype) !void {
            try jw.beginObject();
            try jw.objectField("id");
            try jw.write(self.id);
            try jw.objectField("text");
            try jw.write(self.text);
            try jw.objectField("kv");
            try jw.print("{s}", .{self.kv}); // raw JSON
            try jw.objectField("instance");
            try jw.write(self.instance);
            try jw.objectField("relates");
            try jw.write(self.relates);
            try jw.endObject();
        }
    };

    pub fn jsonStringify(self: *const ScopeResult, jw: anytype) !void {
        try jw.beginObject();
        try jw.objectField("scope");
        try jw.write(self.scope);
        try jw.objectField("chunks");
        try jw.beginObject();
        try jw.objectField("total");
        try jw.write(self.total_chunks);
        try jw.objectField("in_scope");
        try jw.write(self.in_scope);
        try jw.objectField("instance");
        try jw.write(self.in_scope_instance);
        try jw.objectField("relates");
        try jw.write(self.in_scope_relates);
        if (self.items) |items| {
            try jw.objectField("items");
            try jw.write(items);
        }
        try jw.endObject();
        try jw.objectField("dimensions");
        try jw.write(self.dimensions);
        try jw.endObject();
    }

    pub fn deinit(self: *ScopeResult, allocator: std.mem.Allocator) void {
        if (self.items) |items| {
            for (items) |item| {
                allocator.free(item.id);
                allocator.free(item.text);
                allocator.free(item.kv);
                for (item.instance) |d| allocator.free(d);
                allocator.free(item.instance);
                for (item.relates) |d| allocator.free(d);
                allocator.free(item.relates);
            }
            allocator.free(items);
        }
        for (self.dimensions) |*dim| {
            for (dim.connections) |conn| allocator.free(conn.dim);
            allocator.free(dim.connections);
            allocator.free(dim.name);
        }
        allocator.free(self.dimensions);
        for (self.scope) |s| allocator.free(s);
        allocator.free(self.scope);
    }
};

/// Materialize current state into temp tables for efficient querying.
/// head_id is the branch HEAD commit. Caller must call dropCurrentState() when done.
fn materializeCurrentState(self: *Db, head_id: []const u8) Error!void {
    // Current chunks (not removed)
    {
        var stmt = try self.prepare(
            \\CREATE TEMP TABLE cur_chunks AS
            \\ SELECT cv.chunk_id, cv.text, cv.kv FROM chunk_versions cv
            \\WHERE cv.rowid IN (
            \\  SELECT MAX(rowid) FROM chunk_versions WHERE commit_id IN (
        ++ ancestry_cte ++
            \\ SELECT id FROM ancestry)
            \\  GROUP BY chunk_id
            \\) AND cv.removed = 0
        );
        defer stmt.finalize();
        try stmt.bindSlice(1, head_id);
        _ = try stmt.step();
    }

    // Current memberships (active)
    {
        var stmt = try self.prepare(
            \\CREATE TEMP TABLE cur_memberships AS
            \\ SELECT mv.chunk_id, mv.dimension, mv.type FROM membership_versions mv
            \\WHERE mv.rowid IN (
            \\  SELECT MAX(rowid) FROM membership_versions WHERE commit_id IN (
        ++ ancestry_cte ++
            \\ SELECT id FROM ancestry)
            \\  GROUP BY chunk_id, dimension
            \\) AND mv.active = 1
            \\AND mv.chunk_id IN (SELECT chunk_id FROM cur_chunks)
        );
        defer stmt.finalize();
        try stmt.bindSlice(1, head_id);
        _ = try stmt.step();
    }
}

fn dropCurrentState(self: *Db) void {
    self.exec("DROP TABLE IF EXISTS cur_chunks") catch {};
    self.exec("DROP TABLE IF EXISTS cur_memberships") catch {};
}

// -- Scope helpers --

const DimCounts = struct { instance: i32, relates: i32 };

/// Collect dimension counts from rows of (dimension, type, count).
fn collectDimCounts(allocator: std.mem.Allocator, stmt: *Statement) Error!std.StringHashMap(DimCounts) {
    var map = std.StringHashMap(DimCounts).init(allocator);
    errdefer {
        var it = map.keyIterator();
        while (it.next()) |k| allocator.free(k.*);
        map.deinit();
    }
    while (try stmt.step()) {
        const name = stmt.columnText(0) orelse continue;
        const mtype = stmt.columnText(1) orelse continue;
        const count = stmt.columnInt(2);

        const key = allocator.dupe(u8, name) catch return error.OutOfMemory;
        const gop = map.getOrPut(key) catch {
            allocator.free(key);
            return error.OutOfMemory;
        };
        if (gop.found_existing) allocator.free(key);
        if (!gop.found_existing) gop.value_ptr.* = .{ .instance = 0, .relates = 0 };
        if (std.mem.eql(u8, mtype, "instance")) {
            gop.value_ptr.instance = count;
        } else {
            gop.value_ptr.relates = count;
        }
    }
    return map;
}

fn freeDimCounts(allocator: std.mem.Allocator, map: *std.StringHashMap(DimCounts)) void {
    var it = map.keyIterator();
    while (it.next()) |k| allocator.free(k.*);
    map.deinit();
}

/// Collect connections from rows of (dim1, dim2, type_on_dim2, count).
fn collectConnections(allocator: std.mem.Allocator, stmt: *Statement) Error!std.StringHashMap(std.StringHashMap(DimCounts)) {
    var map = std.StringHashMap(std.StringHashMap(DimCounts)).init(allocator);
    errdefer freeConnectionMap(allocator, &map);
    while (try stmt.step()) {
        const d1 = stmt.columnText(0) orelse continue;
        const d2 = stmt.columnText(1) orelse continue;
        const ctype = stmt.columnText(2) orelse continue;
        const ccount = stmt.columnInt(3);

        const d1_key = allocator.dupe(u8, d1) catch return error.OutOfMemory;
        const gop = map.getOrPut(d1_key) catch {
            allocator.free(d1_key);
            return error.OutOfMemory;
        };
        if (gop.found_existing) allocator.free(d1_key);
        if (!gop.found_existing) gop.value_ptr.* = std.StringHashMap(DimCounts).init(allocator);

        const d2_key = allocator.dupe(u8, d2) catch return error.OutOfMemory;
        const cgop = gop.value_ptr.getOrPut(d2_key) catch {
            allocator.free(d2_key);
            return error.OutOfMemory;
        };
        if (cgop.found_existing) allocator.free(d2_key);
        if (!cgop.found_existing) cgop.value_ptr.* = .{ .instance = 0, .relates = 0 };
        if (std.mem.eql(u8, ctype, "instance")) {
            cgop.value_ptr.instance = ccount;
        } else {
            cgop.value_ptr.relates = ccount;
        }
    }
    return map;
}

fn freeConnectionMap(allocator: std.mem.Allocator, map: *std.StringHashMap(std.StringHashMap(DimCounts))) void {
    var it = map.iterator();
    while (it.next()) |entry| {
        var inner_it = entry.value_ptr.keyIterator();
        while (inner_it.next()) |k| allocator.free(k.*);
        entry.value_ptr.deinit();
        allocator.free(entry.key_ptr.*);
    }
    map.deinit();
}

/// Build ScopeDim array from dim counts and connection map.
fn buildScopeDims(
    allocator: std.mem.Allocator,
    dim_counts: *std.StringHashMap(DimCounts),
    connections: *std.StringHashMap(std.StringHashMap(DimCounts)),
) Error![]ScopeResult.ScopeDim {
    var dimensions: std.ArrayListAligned(ScopeResult.ScopeDim, null) = .{};
    defer dimensions.deinit(allocator);

    var it = dim_counts.iterator();
    while (it.next()) |entry| {
        const name = entry.key_ptr.*;
        const counts = entry.value_ptr.*;

        var conns: std.ArrayListAligned(ScopeResult.Connection, null) = .{};
        defer conns.deinit(allocator);

        if (connections.get(name)) |*inner| {
            var ci = inner.iterator();
            while (ci.next()) |ce| {
                conns.append(allocator, .{
                    .dim = allocator.dupe(u8, ce.key_ptr.*) catch return error.OutOfMemory,
                    .instance = ce.value_ptr.instance,
                    .relates = ce.value_ptr.relates,
                }) catch return error.OutOfMemory;
            }
        }

        dimensions.append(allocator, .{
            .name = allocator.dupe(u8, name) catch return error.OutOfMemory,
            .shared = counts.instance + counts.relates,
            .instance = counts.instance,
            .relates = counts.relates,
            .connections = conns.toOwnedSlice(allocator) catch return error.OutOfMemory,
        }) catch return error.OutOfMemory;
    }

    return dimensions.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

pub fn scope(self: *Db, allocator: std.mem.Allocator, scope_dims: []const []const u8, include_chunks: bool) Error!ScopeResult {
    const branch = try self.getActiveBranch(allocator);
    defer allocator.free(branch);
    const head = try self.getBranchHead(branch) orelse return error.SqliteError;

    try self.materializeCurrentState(&head);
    defer self.dropCurrentState();

    // Total chunk count
    var total_stmt = try self.prepare("SELECT COUNT(*) FROM cur_chunks");
    defer total_stmt.finalize();
    _ = try total_stmt.step();
    const total_chunks = total_stmt.columnInt(0);

    if (scope_dims.len > 0) {
        // Populate scope filter with parameterized inserts (no SQL injection)
        try self.exec("CREATE TEMP TABLE scope_filter (name TEXT)");
        defer self.exec("DROP TABLE IF EXISTS scope_filter") catch {};
        {
            var ins = try self.prepare("INSERT INTO scope_filter VALUES (?1)");
            defer ins.finalize();
            for (scope_dims) |dim| {
                try ins.bindSlice(1, dim);
                _ = try ins.step();
                try ins.reset();
            }
        }

        // In-scope chunks: membership on ALL scope dimensions
        {
            var stmt = try self.prepare(
                \\CREATE TEMP TABLE in_scope AS
                \\SELECT chunk_id FROM cur_memberships
                \\WHERE dimension IN (SELECT name FROM scope_filter)
                \\GROUP BY chunk_id HAVING COUNT(DISTINCT dimension) = ?1
            );
            defer stmt.finalize();
            try stmt.bindInt(1, @intCast(scope_dims.len));
            _ = try stmt.step();
        }
        defer self.exec("DROP TABLE IF EXISTS in_scope") catch {};

        // Count in-scope chunks
        var count_stmt = try self.prepare("SELECT COUNT(*) FROM in_scope");
        defer count_stmt.finalize();
        _ = try count_stmt.step();
        const in_scope_count = count_stmt.columnInt(0);

        // Instance/relates split at scope level
        var ir_stmt = try self.prepare(
            \\SELECT
            \\  COALESCE(SUM(CASE WHEN has_inst > 0 THEN 1 ELSE 0 END), 0),
            \\  COALESCE(SUM(CASE WHEN has_inst = 0 THEN 1 ELSE 0 END), 0)
            \\FROM (
            \\  SELECT cm.chunk_id,
            \\    SUM(CASE WHEN cm.type = 'instance' THEN 1 ELSE 0 END) as has_inst
            \\  FROM cur_memberships cm
            \\  INNER JOIN in_scope isc ON isc.chunk_id = cm.chunk_id
            \\  WHERE cm.dimension IN (SELECT name FROM scope_filter)
            \\  GROUP BY cm.chunk_id
            \\)
        );
        defer ir_stmt.finalize();
        var in_scope_instance: i32 = 0;
        var in_scope_relates: i32 = 0;
        if (try ir_stmt.step()) {
            in_scope_instance = ir_stmt.columnInt(0);
            in_scope_relates = ir_stmt.columnInt(1);
        }

        // Connected dimensions
        var conn_stmt = try self.prepare(
            \\SELECT cm.dimension, cm.type, COUNT(DISTINCT cm.chunk_id)
            \\FROM cur_memberships cm
            \\INNER JOIN in_scope isc ON isc.chunk_id = cm.chunk_id
            \\WHERE cm.dimension NOT IN (SELECT name FROM scope_filter)
            \\GROUP BY cm.dimension, cm.type ORDER BY cm.dimension
        );
        defer conn_stmt.finalize();
        var dim_counts = try collectDimCounts(allocator, &conn_stmt);
        defer freeDimCounts(allocator, &dim_counts);

        // Connections between connected dims (single self-join)
        var pair_stmt = try self.prepare(
            \\SELECT cm1.dimension, cm2.dimension, cm2.type, COUNT(DISTINCT cm1.chunk_id)
            \\FROM cur_memberships cm1
            \\JOIN cur_memberships cm2 ON cm1.chunk_id = cm2.chunk_id
            \\JOIN in_scope ON in_scope.chunk_id = cm1.chunk_id
            \\WHERE cm1.dimension NOT IN (SELECT name FROM scope_filter)
            \\AND cm2.dimension NOT IN (SELECT name FROM scope_filter)
            \\AND cm1.dimension != cm2.dimension
            \\GROUP BY cm1.dimension, cm2.dimension, cm2.type
        );
        defer pair_stmt.finalize();
        var connections = try collectConnections(allocator, &pair_stmt);
        defer freeConnectionMap(allocator, &connections);

        const dimensions = try buildScopeDims(allocator, &dim_counts, &connections);

        const scope_copy = allocator.alloc([]const u8, scope_dims.len) catch return error.OutOfMemory;
        for (scope_dims, 0..) |dim, i| {
            scope_copy[i] = allocator.dupe(u8, dim) catch return error.OutOfMemory;
        }

        const items = if (include_chunks) try self.fetchChunkItems(allocator, "SELECT chunk_id FROM in_scope") else null;

        return .{
            .scope = scope_copy,
            .total_chunks = total_chunks,
            .in_scope = in_scope_count,
            .in_scope_instance = in_scope_instance,
            .in_scope_relates = in_scope_relates,
            .dimensions = dimensions,
            .items = items,
        };
    }

    // Empty scope — all dimensions with connections
    var dim_stmt = try self.prepare(
        \\SELECT dimension, type, COUNT(DISTINCT chunk_id)
        \\FROM cur_memberships GROUP BY dimension, type ORDER BY dimension
    );
    defer dim_stmt.finalize();
    var dim_counts = try collectDimCounts(allocator, &dim_stmt);
    defer freeDimCounts(allocator, &dim_counts);

    var pair_stmt = try self.prepare(
        \\SELECT cm1.dimension, cm2.dimension, cm2.type, COUNT(DISTINCT cm1.chunk_id)
        \\FROM cur_memberships cm1
        \\JOIN cur_memberships cm2 ON cm1.chunk_id = cm2.chunk_id
        \\WHERE cm1.dimension != cm2.dimension
        \\GROUP BY cm1.dimension, cm2.dimension, cm2.type
    );
    defer pair_stmt.finalize();
    var connections = try collectConnections(allocator, &pair_stmt);
    defer freeConnectionMap(allocator, &connections);

    const dimensions = try buildScopeDims(allocator, &dim_counts, &connections);

    const empty_items = if (include_chunks) try self.fetchChunkItems(allocator, "SELECT chunk_id FROM cur_chunks") else null;

    const scope_copy = allocator.alloc([]const u8, 0) catch return error.OutOfMemory;
    return .{
        .scope = scope_copy,
        .total_chunks = total_chunks,
        .in_scope = total_chunks,
        .in_scope_instance = 0,
        .in_scope_relates = 0,
        .dimensions = dimensions,
        .items = empty_items,
    };
}

// -- Log --

pub const LogEntry = struct {
    id: []const u8,
    parent_id: ?[]const u8,
    timestamp: []const u8,
};

pub fn log(self: *Db, allocator: std.mem.Allocator) Error![]LogEntry {
    const branch = try self.getActiveBranch(allocator);
    defer allocator.free(branch);
    const head = try self.getBranchHead(branch) orelse return error.SqliteError;

    var entries: std.ArrayListAligned(LogEntry, null) = .{};
    defer entries.deinit(allocator);

    var current_id: [20]u8 = head;
    while (true) {
        var stmt = try self.prepare("SELECT id, parent_id, timestamp FROM commits WHERE id = ?1");
        defer stmt.finalize();
        try stmt.bindSlice(1, &current_id);
        if (try stmt.step()) {
            const id = stmt.columnText(0) orelse break;
            const parent = stmt.columnText(1);
            const ts = stmt.columnText(2) orelse "";
            entries.append(allocator, .{
                .id = allocator.dupe(u8, id) catch return error.OutOfMemory,
                .parent_id = if (parent) |p| (allocator.dupe(u8, p) catch return error.OutOfMemory) else null,
                .timestamp = allocator.dupe(u8, ts) catch return error.OutOfMemory,
            }) catch return error.OutOfMemory;
            if (parent) |p| {
                if (p.len == 20) {
                    @memcpy(&current_id, p[0..20]);
                } else break;
            } else break;
        } else break;
    }

    return entries.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

pub fn freeLogEntries(allocator: std.mem.Allocator, entries: []LogEntry) void {
    for (entries) |e| {
        allocator.free(e.id);
        if (e.parent_id) |p| allocator.free(p);
        allocator.free(e.timestamp);
    }
    allocator.free(entries);
}

// -- Show --

/// Show what changed in a commit by comparing its version rows against its parent.
pub fn show(self: *Db, allocator: std.mem.Allocator, commit_id: []const u8) Error!ShowResult {
    // Get chunks modified in this commit
    var cv_stmt = try self.prepare(
        "SELECT chunk_id, text, kv, removed FROM chunk_versions WHERE commit_id = ?1",
    );
    defer cv_stmt.finalize();
    try cv_stmt.bindSlice(1, commit_id);

    var chunks: std.ArrayListAligned(ShowChunk, null) = .{};
    defer chunks.deinit(allocator);

    while (try cv_stmt.step()) {
        const cid = cv_stmt.columnText(0) orelse continue;
        const text = cv_stmt.columnText(1) orelse "";
        const kv = cv_stmt.columnText(2) orelse "{}";
        const removed = cv_stmt.columnInt(3) != 0;

        // Get memberships set in this commit for this chunk
        var mv_stmt = try self.prepare(
            "SELECT dimension, type, active FROM membership_versions WHERE chunk_id = ?1 AND commit_id = ?2",
        );
        defer mv_stmt.finalize();
        try mv_stmt.bindSlice(1, cid);
        try mv_stmt.bindSlice(2, commit_id);

        var instance_dims: std.ArrayListAligned([]const u8, null) = .{};
        defer instance_dims.deinit(allocator);
        var relates_dims: std.ArrayListAligned([]const u8, null) = .{};
        defer relates_dims.deinit(allocator);

        while (try mv_stmt.step()) {
            const dim = mv_stmt.columnText(0) orelse continue;
            const mtype = mv_stmt.columnText(1) orelse continue;
            const active = mv_stmt.columnInt(2) != 0;
            if (active) {
                const dim_copy = allocator.dupe(u8, dim) catch return error.OutOfMemory;
                if (std.mem.eql(u8, mtype, "instance")) {
                    instance_dims.append(allocator, dim_copy) catch return error.OutOfMemory;
                } else {
                    relates_dims.append(allocator, dim_copy) catch return error.OutOfMemory;
                }
            }
        }

        chunks.append(allocator, .{
            .id = allocator.dupe(u8, cid) catch return error.OutOfMemory,
            .text = if (!removed) (allocator.dupe(u8, text) catch return error.OutOfMemory) else null,
            .kv = if (!removed) (allocator.dupe(u8, kv) catch return error.OutOfMemory) else null,
            .removed = removed,
            .instance = instance_dims.toOwnedSlice(allocator) catch return error.OutOfMemory,
            .relates = relates_dims.toOwnedSlice(allocator) catch return error.OutOfMemory,
        }) catch return error.OutOfMemory;
    }

    return .{
        .commit_id = allocator.dupe(u8, commit_id) catch return error.OutOfMemory,
        .chunks = chunks.toOwnedSlice(allocator) catch return error.OutOfMemory,
    };
}

pub const ShowChunk = struct {
    id: []const u8,
    text: ?[]const u8,
    kv: ?[]const u8,
    removed: bool,
    instance: []const []const u8,
    relates: []const []const u8,

    /// Lean JSON: absent = unchanged. Only emit fields that have values.
    pub fn jsonStringify(self: *const ShowChunk, jw: anytype) !void {
        try jw.beginObject();
        try jw.objectField("id");
        try jw.write(self.id);
        if (self.removed) {
            try jw.objectField("removed");
            try jw.write(true);
        } else {
            if (self.text) |t| {
                try jw.objectField("text");
                try jw.write(t);
            }
            if (self.kv) |k| {
                try jw.objectField("kv");
                try jw.print("{s}", .{k});
            }
            if (self.instance.len > 0) {
                try jw.objectField("instance");
                try jw.write(self.instance);
            }
            if (self.relates.len > 0) {
                try jw.objectField("relates");
                try jw.write(self.relates);
            }
        }
        try jw.endObject();
    }
};

pub const ShowResult = struct {
    commit_id: []const u8,
    chunks: []ShowChunk,

    pub fn deinit(self: *ShowResult, allocator: std.mem.Allocator) void {
        for (self.chunks) |ch| {
            allocator.free(ch.id);
            if (ch.text) |t| allocator.free(t);
            if (ch.kv) |k| allocator.free(k);
            for (ch.instance) |d| allocator.free(d);
            allocator.free(ch.instance);
            for (ch.relates) |d| allocator.free(d);
            allocator.free(ch.relates);
        }
        allocator.free(self.chunks);
        allocator.free(self.commit_id);
    }

    pub fn jsonStringify(self: *const ShowResult, jw: anytype) !void {
        try jw.beginObject();
        try jw.objectField("commit");
        try jw.write(self.commit_id);
        try jw.objectField("chunks");
        try jw.write(self.chunks);
        try jw.endObject();
    }
};

// -- Branch --

pub const BranchInfo = struct {
    name: []const u8,
    head: []const u8,
};

pub fn branchCreate(self: *Db, allocator: std.mem.Allocator, name: []const u8) Error!void {
    const branch = try self.getActiveBranch(allocator);
    defer allocator.free(branch);
    const head = try self.getBranchHead(branch) orelse return error.SqliteError;
    var stmt = try self.prepare("INSERT INTO branches (name, head) VALUES (?1, ?2)");
    defer stmt.finalize();
    try stmt.bindSlice(1, name);
    try stmt.bindSlice(2, &head);
    _ = try stmt.step();
}

pub fn branchSwitch(self: *Db, name: []const u8) Error!void {
    // Verify branch exists
    var stmt = try self.prepare("SELECT head FROM branches WHERE name = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, name);
    if (!(try stmt.step())) return error.InvalidInput;
    try self.setActiveBranch(name);
}

pub fn branchList(self: *Db, allocator: std.mem.Allocator) Error![]BranchInfo {
    var stmt = try self.prepare("SELECT name, head FROM branches ORDER BY name");
    defer stmt.finalize();

    var branches: std.ArrayListAligned(BranchInfo, null) = .{};
    defer branches.deinit(allocator);

    while (try stmt.step()) {
        const name = stmt.columnText(0) orelse continue;
        const head = stmt.columnText(1) orelse continue;
        branches.append(allocator, .{
            .name = allocator.dupe(u8, name) catch return error.OutOfMemory,
            .head = allocator.dupe(u8, head) catch return error.OutOfMemory,
        }) catch return error.OutOfMemory;
    }

    return branches.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

pub fn freeBranchInfos(allocator: std.mem.Allocator, branches: []BranchInfo) void {
    for (branches) |b| {
        allocator.free(b.name);
        allocator.free(b.head);
    }
    allocator.free(branches);
}

pub fn branchDelete(self: *Db, allocator: std.mem.Allocator, name: []const u8) Error!void {
    if (std.mem.eql(u8, name, "main")) return error.InvalidInput;
    // Cannot delete the active branch
    const active = try self.getActiveBranch(allocator);
    defer allocator.free(active);
    if (std.mem.eql(u8, name, active)) return error.InvalidInput;
    var stmt = try self.prepare("DELETE FROM branches WHERE name = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, name);
    _ = try stmt.step();
}

/// Fetch full chunk items (id, text, kv, memberships) for chunks matching a subquery.
fn fetchChunkItems(self: *Db, allocator: std.mem.Allocator, chunk_subquery: [*:0]const u8) Error![]ScopeResult.ChunkItem {
    // Get chunk data
    var buf: [512]u8 = undefined;
    const sql = std.fmt.bufPrint(&buf,
        "SELECT c.chunk_id, c.text, c.kv FROM cur_chunks c WHERE c.chunk_id IN ({s}) ORDER BY c.chunk_id",
        .{std.mem.span(chunk_subquery)},
    ) catch return error.OutOfMemory;
    const sql_z = allocator.dupeZ(u8, sql) catch return error.OutOfMemory;
    defer allocator.free(sql_z);

    var stmt = try self.prepare(sql_z.ptr);
    defer stmt.finalize();

    var items: std.ArrayListAligned(ScopeResult.ChunkItem, null) = .{};
    defer items.deinit(allocator);

    while (try stmt.step()) {
        const chunk_id = stmt.columnText(0) orelse continue;
        const text = stmt.columnText(1) orelse "";
        const kv = stmt.columnText(2) orelse "{}";

        // Get memberships for this chunk
        var mem_stmt = try self.prepare(
            "SELECT dimension, type FROM cur_memberships WHERE chunk_id = ?1 ORDER BY dimension",
        );
        defer mem_stmt.finalize();
        try mem_stmt.bindSlice(1, chunk_id);

        var inst_dims: std.ArrayListAligned([]const u8, null) = .{};
        defer inst_dims.deinit(allocator);
        var rel_dims: std.ArrayListAligned([]const u8, null) = .{};
        defer rel_dims.deinit(allocator);

        while (try mem_stmt.step()) {
            const dim = mem_stmt.columnText(0) orelse continue;
            const mtype = mem_stmt.columnText(1) orelse continue;
            const dim_copy = allocator.dupe(u8, dim) catch return error.OutOfMemory;
            if (std.mem.eql(u8, mtype, "instance")) {
                inst_dims.append(allocator, dim_copy) catch return error.OutOfMemory;
            } else {
                rel_dims.append(allocator, dim_copy) catch return error.OutOfMemory;
            }
        }

        items.append(allocator, .{
            .id = allocator.dupe(u8, chunk_id) catch return error.OutOfMemory,
            .text = allocator.dupe(u8, text) catch return error.OutOfMemory,
            .kv = allocator.dupe(u8, kv) catch return error.OutOfMemory,
            .instance = inst_dims.toOwnedSlice(allocator) catch return error.OutOfMemory,
            .relates = rel_dims.toOwnedSlice(allocator) catch return error.OutOfMemory,
        }) catch return error.OutOfMemory;
    }

    return items.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

// ============================================================
// Tests
// ============================================================

test "open and close in-memory db" {
    var db = try Db.open(":memory:");
    defer db.close();
}

test "init schema creates all tables" {
    var db = try Db.open(":memory:");
    defer db.close();
    try db.initSchema();

    try db.exec("SELECT * FROM commits");
    try db.exec("SELECT * FROM branches");
    try db.exec("SELECT * FROM chunk_versions");
    try db.exec("SELECT * FROM membership_versions");
}

test "create root commit and main branch" {
    var db = try Db.open(":memory:");
    defer db.close();
    try db.initSchema();
    _ = try db.createRootCommit();

    var stmt = try db.prepare("SELECT id, parent_id, timestamp FROM commits");
    defer stmt.finalize();
    try std.testing.expect(try stmt.step());

    // parent_id null for root
    try std.testing.expect(stmt.columnText(1) == null);
    // timestamp non-empty
    try std.testing.expect(stmt.columnText(2) != null);

    // main branch exists
    var bs = try db.prepare("SELECT name, head FROM branches WHERE name = 'main'");
    defer bs.finalize();
    try std.testing.expect(try bs.step());
    try std.testing.expectEqualStrings("main", bs.columnText(0).?);
}

test "generate id produces unique 20-char ids" {
    const id1 = generateId();
    const id2 = generateId();
    try std.testing.expect(id1.len == 20);
    try std.testing.expect(!std.mem.eql(u8, &id1, &id2));
}

fn initTestDb() Error!Db {
    var db = try Db.open(":memory:");
    db.initSchema() catch {
        db.close();
        return error.SqliteError;
    };
    _ = db.createRootCommit() catch {
        db.close();
        return error.SqliteError;
    };
    return db;
}

test "apply creates new chunks with memberships" {
    var db = try initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[
        \\  {
        \\    "text": "The summer youth program runs June through August",
        \\    "kv": {"status": "active"},
        \\    "instance": ["community-programs", "projects"],
        \\    "relates": ["education"]
        \\  }
        \\]}
    ;

    var result = try db.apply(std.testing.allocator, json);
    defer result.deinit(std.testing.allocator);

    // One chunk created
    try std.testing.expect(result.created_ids.len == 1);

    // Verify chunk_versions row
    var cv = try db.prepare("SELECT text, kv, removed FROM chunk_versions WHERE chunk_id = ?1");
    defer cv.finalize();
    try cv.bindSlice(1, &result.created_ids[0]);
    try std.testing.expect(try cv.step());
    try std.testing.expectEqualStrings("The summer youth program runs June through August", cv.columnText(0).?);
    try std.testing.expectEqualStrings("{\"status\":\"active\"}", cv.columnText(1).?);
    try std.testing.expectEqual(cv.columnInt(2), 0);

    // Verify membership_versions rows
    var mv = try db.prepare("SELECT dimension, type FROM membership_versions WHERE chunk_id = ?1 ORDER BY dimension");
    defer mv.finalize();
    try mv.bindSlice(1, &result.created_ids[0]);

    // community-programs (instance)
    try std.testing.expect(try mv.step());
    try std.testing.expectEqualStrings("community-programs", mv.columnText(0).?);
    try std.testing.expectEqualStrings("instance", mv.columnText(1).?);

    // education (relates)
    try std.testing.expect(try mv.step());
    try std.testing.expectEqualStrings("education", mv.columnText(0).?);
    try std.testing.expectEqualStrings("relates", mv.columnText(1).?);

    // projects (instance)
    try std.testing.expect(try mv.step());
    try std.testing.expectEqualStrings("projects", mv.columnText(0).?);
    try std.testing.expectEqualStrings("instance", mv.columnText(1).?);

    // No more rows
    try std.testing.expect(!(try mv.step()));
}

test "apply creates commit and advances HEAD" {
    var db = try initTestDb();
    defer db.close();

    // Get initial HEAD
    const initial_head = try db.getBranchHead("main") orelse return error.SqliteError;

    const json =
        \\{"chunks":[{"text":"test","instance":["dim1"]}]}
    ;

    var result = try db.apply(std.testing.allocator, json);
    defer result.deinit(std.testing.allocator);

    // HEAD should have advanced
    const new_head = try db.getBranchHead("main") orelse return error.SqliteError;
    try std.testing.expect(!std.mem.eql(u8, &initial_head, &new_head));
    try std.testing.expectEqualStrings(&result.commit_id, &new_head);

    // New commit should have parent = initial HEAD
    var stmt = try db.prepare("SELECT parent_id FROM commits WHERE id = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, &result.commit_id);
    try std.testing.expect(try stmt.step());
    try std.testing.expectEqualStrings(&initial_head, stmt.columnText(0).?);
}

test "apply rejects chunk without membership" {
    var db = try initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[{"text":"no dimensions"}]}
    ;

    const result = db.apply(std.testing.allocator, json);
    try std.testing.expectError(error.InvalidInput, result);
}

test "apply multiple chunks in one mutation" {
    var db = try initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[
        \\  {"text":"chunk one","instance":["alpha"]},
        \\  {"text":"chunk two","instance":["alpha","beta"],"relates":["gamma"]}
        \\]}
    ;

    var result = try db.apply(std.testing.allocator, json);
    defer result.deinit(std.testing.allocator);

    try std.testing.expect(result.created_ids.len == 2);

    // Both chunks should exist
    var cv = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE removed = 0");
    defer cv.finalize();
    try std.testing.expect(try cv.step());
    try std.testing.expectEqual(cv.columnInt(0), 2);
}

test "apply reuses existing dimensions" {
    var db = try initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"first","instance":["alpha"]}]}
    ;
    var r1 = try db.apply(std.testing.allocator, json1);
    defer r1.deinit(std.testing.allocator);

    const json2 =
        \\{"chunks":[{"text":"second","instance":["alpha"]}]}
    ;
    var r2 = try db.apply(std.testing.allocator, json2);
    defer r2.deinit(std.testing.allocator);

    // Verify alpha appears as a dimension with count 2 (both chunks)
    const dims = try db.listDims(std.testing.allocator);
    defer freeDimInfos(std.testing.allocator, dims);
    try std.testing.expectEqual(dims.len, 1);
    try std.testing.expectEqualStrings("alpha", dims[0].name);
    try std.testing.expectEqual(dims[0].instance, 2);
}

test "dims returns correct counts" {
    var db = try initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[
        \\  {"text":"chunk A","instance":["culture","projects"],"relates":["people"]},
        \\  {"text":"chunk B","instance":["culture"],"relates":["projects","education"]},
        \\  {"text":"chunk C","instance":["people"],"relates":["culture"]}
        \\]}
    ;
    var r = try db.apply(std.testing.allocator, json);
    defer r.deinit(std.testing.allocator);

    const dims = try db.listDims(std.testing.allocator);
    defer freeDimInfos(std.testing.allocator, dims);

    // Should have 4 dimensions: culture, education, people, projects (sorted)
    try std.testing.expectEqual(dims.len, 4);

    // culture: instance=2 (A,B), relates=1 (C), total=3
    try std.testing.expectEqualStrings("culture", dims[0].name);
    try std.testing.expectEqual(dims[0].instance, 2);
    try std.testing.expectEqual(dims[0].relates, 1);
    try std.testing.expectEqual(dims[0].total, 3);

    // education: instance=0, relates=1 (B), total=1
    try std.testing.expectEqualStrings("education", dims[1].name);
    try std.testing.expectEqual(dims[1].instance, 0);
    try std.testing.expectEqual(dims[1].relates, 1);
    try std.testing.expectEqual(dims[1].total, 1);

    // people: instance=1 (C), relates=1 (A), total=2
    try std.testing.expectEqualStrings("people", dims[2].name);
    try std.testing.expectEqual(dims[2].instance, 1);
    try std.testing.expectEqual(dims[2].relates, 1);
    try std.testing.expectEqual(dims[2].total, 2);

    // projects: instance=1 (A), relates=1 (B), total=2
    try std.testing.expectEqualStrings("projects", dims[3].name);
    try std.testing.expectEqual(dims[3].instance, 1);
    try std.testing.expectEqual(dims[3].relates, 1);
    try std.testing.expectEqual(dims[3].total, 2);
}

test "dims across multiple applies" {
    var db = try initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"first","instance":["alpha"],"relates":["beta"]}]}
    ;
    var r1 = try db.apply(std.testing.allocator, json1);
    defer r1.deinit(std.testing.allocator);

    const json2 =
        \\{"chunks":[{"text":"second","instance":["beta"],"relates":["gamma"]}]}
    ;
    var r2 = try db.apply(std.testing.allocator, json2);
    defer r2.deinit(std.testing.allocator);

    const dims = try db.listDims(std.testing.allocator);
    defer freeDimInfos(std.testing.allocator, dims);

    try std.testing.expectEqual(dims.len, 3);
    // alpha: instance=1, relates=0
    try std.testing.expectEqualStrings("alpha", dims[0].name);
    try std.testing.expectEqual(dims[0].instance, 1);
    try std.testing.expectEqual(dims[0].relates, 0);
    // beta: instance=1, relates=1
    try std.testing.expectEqualStrings("beta", dims[1].name);
    try std.testing.expectEqual(dims[1].instance, 1);
    try std.testing.expectEqual(dims[1].relates, 1);
    // gamma: instance=0, relates=1
    try std.testing.expectEqualStrings("gamma", dims[2].name);
    try std.testing.expectEqual(dims[2].instance, 0);
    try std.testing.expectEqual(dims[2].relates, 1);
}

test "scope returns connected dimensions with counts" {
    var db = try initTestDb();
    defer db.close();

    // Set up: 3 chunks across 4 dimensions
    // chunk A: instance culture, instance projects, relates people
    // chunk B: instance culture, relates education
    // chunk C: instance people, relates culture
    const input =
        \\{"chunks":[
        \\  {"text":"A","instance":["culture","projects"],"relates":["people"]},
        \\  {"text":"B","instance":["culture"],"relates":["education"]},
        \\  {"text":"C","instance":["people"],"relates":["culture"]}
        \\]}
    ;
    var r = try db.apply(std.testing.allocator, input);
    defer r.deinit(std.testing.allocator);

    // Scope to "culture"
    const scope_dims = [_][]const u8{"culture"};
    var result = try db.scope(std.testing.allocator, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    // Total chunks = 3
    try std.testing.expectEqual(result.total_chunks, 3);
    // In-scope chunks: A (instance culture), B (instance culture), C (relates culture) = 3
    try std.testing.expectEqual(result.in_scope, 3);
    // Instance on culture: A + B = 2, relates on culture: C = 1
    try std.testing.expectEqual(result.in_scope_instance, 2);
    try std.testing.expectEqual(result.in_scope_relates, 1);
    // Scope should be ["culture"]
    try std.testing.expectEqual(result.scope.len, 1);
    try std.testing.expectEqualStrings("culture", result.scope[0]);

    // Connected dimensions (not "culture"):
    // projects: A is instance → shared=1, instance=1, relates=0
    // people: A relates, C instance → shared=2, instance=1, relates=1
    // education: B relates → shared=1, instance=0, relates=1
    try std.testing.expect(result.dimensions.len == 3);

    // Find each dimension (order may vary due to HashMap)
    var found_projects = false;
    var found_people = false;
    var found_education = false;
    for (result.dimensions) |dim| {
        if (std.mem.eql(u8, dim.name, "projects")) {
            found_projects = true;
            try std.testing.expectEqual(dim.shared, 1);
            try std.testing.expectEqual(dim.instance, 1);
            try std.testing.expectEqual(dim.relates, 0);
        } else if (std.mem.eql(u8, dim.name, "people")) {
            found_people = true;
            try std.testing.expectEqual(dim.shared, 2);
            try std.testing.expectEqual(dim.instance, 1);
            try std.testing.expectEqual(dim.relates, 1);
        } else if (std.mem.eql(u8, dim.name, "education")) {
            found_education = true;
            try std.testing.expectEqual(dim.shared, 1);
            try std.testing.expectEqual(dim.instance, 0);
            try std.testing.expectEqual(dim.relates, 1);
        }
    }
    try std.testing.expect(found_projects);
    try std.testing.expect(found_people);
    try std.testing.expect(found_education);
}

test "scope connections between connected dimensions" {
    var db = try initTestDb();
    defer db.close();

    // chunk A: instance culture, instance projects, relates people
    // chunk B: instance culture, instance people
    // Scope to "culture" → in-scope: A, B
    // Connected: projects (A), people (A relates, B instance)
    // Connection projects↔people: chunk A touches both → on people: relates
    const input =
        \\{"chunks":[
        \\  {"text":"A","instance":["culture","projects"],"relates":["people"]},
        \\  {"text":"B","instance":["culture","people"]}
        \\]}
    ;
    var r = try db.apply(std.testing.allocator, input);
    defer r.deinit(std.testing.allocator);

    const scope_dims = [_][]const u8{"culture"};
    var result = try db.scope(std.testing.allocator, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(result.in_scope, 2);

    // Find projects dimension and check its connection to people
    for (result.dimensions) |dim| {
        if (std.mem.eql(u8, dim.name, "projects")) {
            // projects has 1 shared chunk (A), connections to people via chunk A
            try std.testing.expectEqual(dim.shared, 1);
            try std.testing.expect(dim.connections.len >= 1);
            for (dim.connections) |conn| {
                if (std.mem.eql(u8, conn.dim, "people")) {
                    // Chunk A is relates on people
                    try std.testing.expectEqual(conn.relates, 1);
                }
            }
        }
    }
}

test "scope with narrow intersection" {
    var db = try initTestDb();
    defer db.close();

    // chunk A: instance culture, instance projects
    // chunk B: instance culture, instance people
    // chunk C: instance projects, instance people
    const input =
        \\{"chunks":[
        \\  {"text":"A","instance":["culture","projects"]},
        \\  {"text":"B","instance":["culture","people"]},
        \\  {"text":"C","instance":["projects","people"]}
        \\]}
    ;
    var r = try db.apply(std.testing.allocator, input);
    defer r.deinit(std.testing.allocator);

    // Scope to culture+projects → only chunk A matches (has both)
    const scope_dims = [_][]const u8{ "culture", "projects" };
    var result = try db.scope(std.testing.allocator, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(result.total_chunks, 3);
    try std.testing.expectEqual(result.in_scope, 1);
    try std.testing.expectEqual(result.dimensions.len, 0);
}

test "scope with --chunks returns chunk items" {
    var db = try initTestDb();
    defer db.close();

    const input =
        \\{"chunks":[
        \\  {"text":"Alpha chunk","kv":{"status":"active"},"instance":["culture"],"relates":["projects"]},
        \\  {"text":"Beta chunk","instance":["culture","projects"]}
        \\]}
    ;
    var r = try db.apply(std.testing.allocator, input);
    defer r.deinit(std.testing.allocator);

    const scope_dims = [_][]const u8{"culture"};
    var result = try db.scope(std.testing.allocator, &scope_dims, true);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(result.in_scope, 2);
    try std.testing.expect(result.items != null);
    const items = result.items.?;
    try std.testing.expectEqual(items.len, 2);

    // Each chunk should have full membership
    for (items) |item| {
        try std.testing.expect(item.id.len == 20);
        try std.testing.expect(item.text.len > 0);
        try std.testing.expect(item.instance.len > 0 or item.relates.len > 0);
    }
}

test "scope without --chunks has no items" {
    var db = try initTestDb();
    defer db.close();

    const input =
        \\{"chunks":[{"text":"test","instance":["dim1"]}]}
    ;
    var r = try db.apply(std.testing.allocator, input);
    defer r.deinit(std.testing.allocator);

    const scope_dims = [_][]const u8{"dim1"};
    var result = try db.scope(std.testing.allocator, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expect(result.items == null);
}

test "apply update changes text" {
    var db = try initTestDb();
    defer db.close();

    // Create a chunk
    const json1 =
        \\{"chunks":[{"text":"original text","instance":["alpha"]}]}
    ;
    var r1 = try db.apply(std.testing.allocator, json1);
    defer r1.deinit(std.testing.allocator);
    const chunk_id = &r1.created_ids[0];

    // Update its text
    var update_json_buf: [256]u8 = undefined;
    const update_json = std.fmt.bufPrint(&update_json_buf,
        \\{{"chunks":[{{"id":"{s}","text":"updated text"}}]}}
    , .{chunk_id}) catch unreachable;

    var r2 = try db.apply(std.testing.allocator, update_json);
    defer r2.deinit(std.testing.allocator);

    // Verify new version exists with updated text
    var stmt = try db.prepare("SELECT text FROM chunk_versions WHERE chunk_id = ?1 ORDER BY rowid DESC LIMIT 1");
    defer stmt.finalize();
    try stmt.bindSlice(1, chunk_id);
    try std.testing.expect(try stmt.step());
    try std.testing.expectEqualStrings("updated text", stmt.columnText(0).?);

    // Old version should still exist (lossless)
    var count_stmt = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE chunk_id = ?1");
    defer count_stmt.finalize();
    try count_stmt.bindSlice(1, chunk_id);
    try std.testing.expect(try count_stmt.step());
    try std.testing.expectEqual(count_stmt.columnInt(0), 2);
}

test "apply update changes membership" {
    var db = try initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"test","instance":["alpha","beta"],"relates":["gamma"]}]}
    ;
    var r1 = try db.apply(std.testing.allocator, json1);
    defer r1.deinit(std.testing.allocator);
    const chunk_id = &r1.created_ids[0];

    // Update: remove beta, add delta, change gamma from relates to instance
    var update_buf: [256]u8 = undefined;
    const update_json = std.fmt.bufPrint(&update_buf,
        \\{{"chunks":[{{"id":"{s}","instance":["alpha","gamma","delta"],"relates":[]}}]}}
    , .{chunk_id}) catch unreachable;

    var r2 = try db.apply(std.testing.allocator, update_json);
    defer r2.deinit(std.testing.allocator);

    // Check current memberships via scope
    const scope_dims = [_][]const u8{"alpha"};
    var result = try db.scope(std.testing.allocator, &scope_dims, true);
    defer result.deinit(std.testing.allocator);

    const items = result.items.?;
    try std.testing.expectEqual(items.len, 1);

    // Should have instance: alpha, gamma, delta. relates: empty.
    try std.testing.expectEqual(items[0].instance.len, 3);
    try std.testing.expectEqual(items[0].relates.len, 0);
}

test "apply remove marks chunk as removed" {
    var db = try initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"to be removed","instance":["alpha"]}]}
    ;
    var r1 = try db.apply(std.testing.allocator, json1);
    defer r1.deinit(std.testing.allocator);
    const chunk_id = &r1.created_ids[0];

    // Remove it
    var remove_buf: [128]u8 = undefined;
    const remove_json = std.fmt.bufPrint(&remove_buf,
        \\{{"chunks":[{{"id":"{s}","removed":true}}]}}
    , .{chunk_id}) catch unreachable;

    var r2 = try db.apply(std.testing.allocator, remove_json);
    defer r2.deinit(std.testing.allocator);

    // Should not appear in scope
    const scope_dims = [_][]const u8{"alpha"};
    var result = try db.scope(std.testing.allocator, &scope_dims, true);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(result.in_scope, 0);
    try std.testing.expectEqual(result.items.?.len, 0);

    // But version history should be preserved (2 chunk_versions rows)
    var count_stmt = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE chunk_id = ?1");
    defer count_stmt.finalize();
    try count_stmt.bindSlice(1, chunk_id);
    try std.testing.expect(try count_stmt.step());
    try std.testing.expectEqual(count_stmt.columnInt(0), 2);
}

test "active branch defaults to main" {
    var db = try initTestDb();
    defer db.close();

    const branch = try db.getActiveBranch(std.testing.allocator);
    defer std.testing.allocator.free(branch);
    try std.testing.expectEqualStrings("main", branch);
}

test "branch switch changes active branch and isolates state" {
    var db = try initTestDb();
    defer db.close();

    // Apply on main
    const json1 =
        \\{"chunks":[{"text":"on main","instance":["alpha"]}]}
    ;
    var r1 = try db.apply(std.testing.allocator, json1);
    defer r1.deinit(std.testing.allocator);

    // Create and switch to feature branch
    try db.branchCreate(std.testing.allocator, "feature");
    try db.branchSwitch("feature");

    const branch = try db.getActiveBranch(std.testing.allocator);
    defer std.testing.allocator.free(branch);
    try std.testing.expectEqualStrings("feature", branch);

    // Apply on feature branch
    const json2 =
        \\{"chunks":[{"text":"on feature","instance":["beta"]}]}
    ;
    var r2 = try db.apply(std.testing.allocator, json2);
    defer r2.deinit(std.testing.allocator);

    // Feature branch should see both chunks
    const dims_feature = try db.listDims(std.testing.allocator);
    defer freeDimInfos(std.testing.allocator, dims_feature);
    try std.testing.expectEqual(dims_feature.len, 2);

    // Switch back to main
    try db.branchSwitch("main");

    // Main should only see alpha
    const dims_main = try db.listDims(std.testing.allocator);
    defer freeDimInfos(std.testing.allocator, dims_main);
    try std.testing.expectEqual(dims_main.len, 1);
    try std.testing.expectEqualStrings("alpha", dims_main[0].name);
}

test "empty scope returns all dimensions with connections" {
    var db = try initTestDb();
    defer db.close();

    const input =
        \\{"chunks":[
        \\  {"text":"A","instance":["culture","projects"],"relates":["people"]},
        \\  {"text":"B","instance":["culture"],"relates":["education"]},
        \\  {"text":"C","instance":["people"],"relates":["culture"]}
        \\]}
    ;
    var r = try db.apply(std.testing.allocator, input);
    defer r.deinit(std.testing.allocator);

    // Empty scope
    const scope_dims = [_][]const u8{};
    var result = try db.scope(std.testing.allocator, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(result.scope.len, 0);
    try std.testing.expectEqual(result.total_chunks, 3);
    try std.testing.expectEqual(result.in_scope, 3);
    // Should have 4 dimensions: culture, education, people, projects
    try std.testing.expectEqual(result.dimensions.len, 4);

    // Each dimension should have connections to other dimensions
    var found_culture = false;
    for (result.dimensions) |dim| {
        if (std.mem.eql(u8, dim.name, "culture")) {
            found_culture = true;
            // culture: instance=2 (A,B), relates=1 (C), total=3
            try std.testing.expectEqual(dim.shared, 3);
            try std.testing.expectEqual(dim.instance, 2);
            try std.testing.expectEqual(dim.relates, 1);
            // Should have connections to projects, people, education
            try std.testing.expect(dim.connections.len > 0);
        }
    }
    try std.testing.expect(found_culture);
}
