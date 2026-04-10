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

    return id;
}

// -- Commit / Branch helpers --

/// Get the HEAD commit id for the given branch.
pub fn getHead(self: *Db, branch: []const u8) Error![20]u8 {
    return try self.getBranchHead(branch) orelse return error.SqliteError;
}

/// Get the HEAD commit id for the given branch
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
pub fn createCommit(self: *Db, parent_id: []const u8) Error![20]u8 {
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
pub fn advanceBranch(self: *Db, branch: []const u8, commit_id: []const u8) Error!void {
    var stmt = try self.prepare("UPDATE branches SET head = ?1 WHERE name = ?2");
    defer stmt.finalize();
    try stmt.bindSlice(1, commit_id);
    try stmt.bindSlice(2, branch);
    _ = try stmt.step();
}

// -- State Resolution --

/// The recursive CTE fragment used to walk commit ancestry from a HEAD.
/// Expects ?1 to be bound to the HEAD commit id.
pub const ancestry_cte =
    \\WITH RECURSIVE ancestry(id) AS (
    \\  SELECT ?1
    \\  UNION ALL
    \\  SELECT c.parent_id FROM commits c JOIN ancestry a ON c.id = a.id WHERE c.parent_id IS NOT NULL
    \\)
;

/// Materialize current state into temp tables for efficient querying.
/// head_id is the branch HEAD commit. Caller must call dropCurrentState() when done.
pub fn materializeCurrentState(self: *Db, head_id: []const u8) Error!void {
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

pub fn dropCurrentState(self: *Db) void {
    self.exec("DROP TABLE IF EXISTS cur_chunks") catch {};
    self.exec("DROP TABLE IF EXISTS cur_memberships") catch {};
}

// -- Test helpers --

pub fn initTestDb() Error!Db {
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

test "getHead returns head for main" {
    var db = try initTestDb();
    defer db.close();

    const head = try db.getHead("main");
    try std.testing.expect(head.len == 20);
}
