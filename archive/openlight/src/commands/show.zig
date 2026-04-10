const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

/// Show what changed in a commit by comparing its version rows against its parent.
pub fn run(db: *Db, allocator: std.mem.Allocator, commit_id: []const u8) Error!ShowResult {

    // query chunk versions created in this commit
    var cv_stmt = try db.prepare(
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

        // query memberships set in this commit for this chunk
        const memberships = try queryMemberships(db, allocator, cid, commit_id);

        chunks.append(allocator, .{
            .id = allocator.dupe(u8, cid) catch return error.OutOfMemory,
            .text = if (!removed) (allocator.dupe(u8, text) catch return error.OutOfMemory) else null,
            .kv = if (!removed) (allocator.dupe(u8, kv) catch return error.OutOfMemory) else null,
            .removed = removed,
            .instance = memberships.instance,
            .relates = memberships.relates,
        }) catch return error.OutOfMemory;
    }

    return .{
        .commit = allocator.dupe(u8, commit_id) catch return error.OutOfMemory,
        .chunks = chunks.toOwnedSlice(allocator) catch return error.OutOfMemory,
    };
}

// -- Helpers --

const Memberships = struct {
    instance: []const []const u8,
    relates: []const []const u8,
};

fn queryMemberships(db: *Db, allocator: std.mem.Allocator, chunk_id: []const u8, commit_id: []const u8) Error!Memberships {
    var stmt = try db.prepare(
        "SELECT dimension, type, active FROM membership_versions WHERE chunk_id = ?1 AND commit_id = ?2",
    );
    defer stmt.finalize();
    try stmt.bindSlice(1, chunk_id);
    try stmt.bindSlice(2, commit_id);

    var instance: std.ArrayListAligned([]const u8, null) = .{};
    defer instance.deinit(allocator);
    var relates: std.ArrayListAligned([]const u8, null) = .{};
    defer relates.deinit(allocator);

    while (try stmt.step()) {
        const dim = stmt.columnText(0) orelse continue;
        const mtype = stmt.columnText(1) orelse continue;
        const active = stmt.columnInt(2) != 0;

        if (active) {
            const dim_copy = allocator.dupe(u8, dim) catch return error.OutOfMemory;

            if (std.mem.eql(u8, mtype, "instance")) {
                instance.append(allocator, dim_copy) catch return error.OutOfMemory;
            } else {
                relates.append(allocator, dim_copy) catch return error.OutOfMemory;
            }
        }
    }

    return .{
        .instance = instance.toOwnedSlice(allocator) catch return error.OutOfMemory,
        .relates = relates.toOwnedSlice(allocator) catch return error.OutOfMemory,
    };
}

// -- Types --

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
    commit: []const u8,
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
        allocator.free(self.commit);
    }
};
