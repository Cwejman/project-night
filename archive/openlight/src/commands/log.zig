const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

pub const Filters = struct {
    limit: ?usize = null,
    chunk: ?[]const u8 = null,
    dim: ?[]const u8 = null,
};

/// Walk commit history from HEAD back to root.
/// Optionally filter by chunk id, dimension name, or limit count.
pub fn run(db: *Db, allocator: std.mem.Allocator, head: []const u8, filters: Filters) Error![]LogEntry {

    var entries: std.ArrayListAligned(LogEntry, null) = .{};
    defer entries.deinit(allocator);

    var current_id: [20]u8 = undefined;
    @memcpy(&current_id, head[0..20]);

    while (true) {
        // check limit
        if (filters.limit) |max| {
            if (entries.items.len >= max) break;
        }

        var stmt = try db.prepare("SELECT id, parent_id, timestamp FROM commits WHERE id = ?1");
        defer stmt.finalize();
        try stmt.bindSlice(1, &current_id);

        if (!(try stmt.step())) break;

        // read this commit
        const id = stmt.columnText(0) orelse break;
        const parent = stmt.columnText(1);
        const ts = stmt.columnText(2) orelse "";

        // apply filters
        const include = try matchesFilters(db, id, filters);

        if (include) {
            entries.append(allocator, .{
                .id = allocator.dupe(u8, id) catch return error.OutOfMemory,
                .parent_id = if (parent) |p| (allocator.dupe(u8, p) catch return error.OutOfMemory) else null,
                .timestamp = allocator.dupe(u8, ts) catch return error.OutOfMemory,
            }) catch return error.OutOfMemory;
        }

        // follow parent pointer
        if (parent) |p| {
            if (p.len == 20) {
                @memcpy(&current_id, p[0..20]);
            } else break;
        } else break;
    }

    return entries.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

// -- Filters --

fn matchesFilters(db: *Db, commit_id: []const u8, filters: Filters) Error!bool {
    if (filters.chunk) |chunk_id| {
        if (!(try commitTouchesChunk(db, commit_id, chunk_id))) return false;
    }
    if (filters.dim) |dim_name| {
        if (!(try commitTouchesDim(db, commit_id, dim_name))) return false;
    }
    return true;
}

fn commitTouchesChunk(db: *Db, commit_id: []const u8, chunk_id: []const u8) Error!bool {
    var stmt = try db.prepare("SELECT 1 FROM chunk_versions WHERE commit_id = ?1 AND chunk_id = ?2 LIMIT 1");
    defer stmt.finalize();
    try stmt.bindSlice(1, commit_id);
    try stmt.bindSlice(2, chunk_id);
    return try stmt.step();
}

fn commitTouchesDim(db: *Db, commit_id: []const u8, dim_name: []const u8) Error!bool {
    var stmt = try db.prepare("SELECT 1 FROM membership_versions WHERE commit_id = ?1 AND dimension = ?2 LIMIT 1");
    defer stmt.finalize();
    try stmt.bindSlice(1, commit_id);
    try stmt.bindSlice(2, dim_name);
    return try stmt.step();
}

// -- Types --

pub const LogEntry = struct {
    id: []const u8,
    parent_id: ?[]const u8,
    timestamp: []const u8,
};

pub fn freeLogEntries(allocator: std.mem.Allocator, entries: []LogEntry) void {
    for (entries) |e| {
        allocator.free(e.id);
        if (e.parent_id) |p| allocator.free(p);
        allocator.free(e.timestamp);
    }
    allocator.free(entries);
}
