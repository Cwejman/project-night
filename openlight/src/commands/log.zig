const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

/// Walk commit history from active branch HEAD back to root.
pub fn run(db: *Db, allocator: std.mem.Allocator, branch: []const u8) Error![]LogEntry {
    const head = try db.getHead(branch);

    var entries: std.ArrayListAligned(LogEntry, null) = .{};
    defer entries.deinit(allocator);

    var current_id: [20]u8 = head;

    while (true) {
        var stmt = try db.prepare("SELECT id, parent_id, timestamp FROM commits WHERE id = ?1");
        defer stmt.finalize();
        try stmt.bindSlice(1, &current_id);

        if (!(try stmt.step())) break;

        // read this commit
        const id = stmt.columnText(0) orelse break;
        const parent = stmt.columnText(1);
        const ts = stmt.columnText(2) orelse "";

        entries.append(allocator, .{
            .id = allocator.dupe(u8, id) catch return error.OutOfMemory,
            .parent_id = if (parent) |p| (allocator.dupe(u8, p) catch return error.OutOfMemory) else null,
            .timestamp = allocator.dupe(u8, ts) catch return error.OutOfMemory,
        }) catch return error.OutOfMemory;

        // follow parent pointer
        if (parent) |p| {
            if (p.len == 20) {
                @memcpy(&current_id, p[0..20]);
            } else break;
        } else break;
    }

    return entries.toOwnedSlice(allocator) catch return error.OutOfMemory;
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
