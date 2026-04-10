const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

/// Compare resolved state at two commits.
/// Returns the declarative mutation that would transform state A into state B.
pub fn run(db: *Db, allocator: std.mem.Allocator, commit_a: []const u8, commit_b: []const u8) Error!DiffResult {

    // resolve state at A
    const state_a = try resolveState(db, allocator, commit_a);
    defer freeState(allocator, state_a);

    // resolve state at B
    const state_b = try resolveState(db, allocator, commit_b);
    defer freeState(allocator, state_b);

    // compute diff
    return computeDiff(allocator, commit_a, commit_b, state_a, state_b);
}

// -- State snapshot --

const ChunkState = struct {
    id: []const u8,
    text: []const u8,
    kv: []const u8,
    instance: []const []const u8,
    relates: []const []const u8,
};

fn resolveState(db: *Db, allocator: std.mem.Allocator, commit_id: []const u8) Error![]ChunkState {
    try db.materializeCurrentState(commit_id);
    defer db.dropCurrentState();

    // collect all chunks with their memberships
    var stmt = try db.prepare("SELECT chunk_id, text, kv FROM cur_chunks ORDER BY chunk_id");
    defer stmt.finalize();

    var chunks: std.ArrayListAligned(ChunkState, null) = .{};
    defer chunks.deinit(allocator);

    while (try stmt.step()) {
        const cid = stmt.columnText(0) orelse continue;
        const text = stmt.columnText(1) orelse "";
        const kv = stmt.columnText(2) orelse "{}";

        // memberships
        var mem_stmt = try db.prepare(
            "SELECT dimension, type FROM cur_memberships WHERE chunk_id = ?1 ORDER BY dimension",
        );
        defer mem_stmt.finalize();
        try mem_stmt.bindSlice(1, cid);

        var inst: std.ArrayListAligned([]const u8, null) = .{};
        defer inst.deinit(allocator);
        var rel: std.ArrayListAligned([]const u8, null) = .{};
        defer rel.deinit(allocator);

        while (try mem_stmt.step()) {
            const dim = mem_stmt.columnText(0) orelse continue;
            const mtype = mem_stmt.columnText(1) orelse continue;
            const dim_copy = allocator.dupe(u8, dim) catch return error.OutOfMemory;

            if (std.mem.eql(u8, mtype, "instance")) {
                inst.append(allocator, dim_copy) catch return error.OutOfMemory;
            } else {
                rel.append(allocator, dim_copy) catch return error.OutOfMemory;
            }
        }

        chunks.append(allocator, .{
            .id = allocator.dupe(u8, cid) catch return error.OutOfMemory,
            .text = allocator.dupe(u8, text) catch return error.OutOfMemory,
            .kv = allocator.dupe(u8, kv) catch return error.OutOfMemory,
            .instance = inst.toOwnedSlice(allocator) catch return error.OutOfMemory,
            .relates = rel.toOwnedSlice(allocator) catch return error.OutOfMemory,
        }) catch return error.OutOfMemory;
    }

    return chunks.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

fn freeState(allocator: std.mem.Allocator, state: []ChunkState) void {
    for (state) |ch| {
        allocator.free(ch.id);
        allocator.free(ch.text);
        allocator.free(ch.kv);
        for (ch.instance) |d| allocator.free(d);
        allocator.free(ch.instance);
        for (ch.relates) |d| allocator.free(d);
        allocator.free(ch.relates);
    }
    allocator.free(state);
}

// -- Diff computation --

fn computeDiff(allocator: std.mem.Allocator, commit_a: []const u8, commit_b: []const u8, state_a: []ChunkState, state_b: []ChunkState) Error!DiffResult {

    // index state A by chunk_id
    var a_map = std.StringHashMap(*const ChunkState).init(allocator);
    defer a_map.deinit();
    for (state_a) |*ch| {
        a_map.put(ch.id, ch) catch return error.OutOfMemory;
    }

    // index state B by chunk_id
    var b_map = std.StringHashMap(*const ChunkState).init(allocator);
    defer b_map.deinit();
    for (state_b) |*ch| {
        b_map.put(ch.id, ch) catch return error.OutOfMemory;
    }

    var chunks: std.ArrayListAligned(DiffChunk, null) = .{};
    defer chunks.deinit(allocator);

    // chunks in B but not A → created
    // chunks in both → check for changes
    for (state_b) |*b_ch| {
        if (a_map.get(b_ch.id)) |a_ch| {
            // exists in both — check for changes
            const text_changed = !std.mem.eql(u8, a_ch.text, b_ch.text);
            const kv_changed = !std.mem.eql(u8, a_ch.kv, b_ch.kv);
            const inst_changed = !slicesEqual(a_ch.instance, b_ch.instance);
            const rel_changed = !slicesEqual(a_ch.relates, b_ch.relates);

            if (text_changed or kv_changed or inst_changed or rel_changed) {
                chunks.append(allocator, .{
                    .id = allocator.dupe(u8, b_ch.id) catch return error.OutOfMemory,
                    .text = if (text_changed) (allocator.dupe(u8, b_ch.text) catch return error.OutOfMemory) else null,
                    .kv = if (kv_changed) (allocator.dupe(u8, b_ch.kv) catch return error.OutOfMemory) else null,
                    .removed = false,
                    .instance = if (inst_changed) (try dupeSlice(allocator, b_ch.instance)) else null,
                    .relates = if (rel_changed) (try dupeSlice(allocator, b_ch.relates)) else null,
                }) catch return error.OutOfMemory;
            }
        } else {
            // new in B
            chunks.append(allocator, .{
                .id = allocator.dupe(u8, b_ch.id) catch return error.OutOfMemory,
                .text = allocator.dupe(u8, b_ch.text) catch return error.OutOfMemory,
                .kv = allocator.dupe(u8, b_ch.kv) catch return error.OutOfMemory,
                .removed = false,
                .instance = try dupeSlice(allocator, b_ch.instance),
                .relates = try dupeSlice(allocator, b_ch.relates),
            }) catch return error.OutOfMemory;
        }
    }

    // chunks in A but not B → removed
    for (state_a) |*a_ch| {
        if (!b_map.contains(a_ch.id)) {
            chunks.append(allocator, .{
                .id = allocator.dupe(u8, a_ch.id) catch return error.OutOfMemory,
                .text = null,
                .kv = null,
                .removed = true,
                .instance = null,
                .relates = null,
            }) catch return error.OutOfMemory;
        }
    }

    return .{
        .from = allocator.dupe(u8, commit_a) catch return error.OutOfMemory,
        .to = allocator.dupe(u8, commit_b) catch return error.OutOfMemory,
        .chunks = chunks.toOwnedSlice(allocator) catch return error.OutOfMemory,
    };
}

// -- Helpers --

fn slicesEqual(a: []const []const u8, b: []const []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |x, y| {
        if (!std.mem.eql(u8, x, y)) return false;
    }
    return true;
}

fn dupeSlice(allocator: std.mem.Allocator, src: []const []const u8) Error![]const []const u8 {
    const copy = allocator.alloc([]const u8, src.len) catch return error.OutOfMemory;
    for (src, 0..) |s, i| {
        copy[i] = allocator.dupe(u8, s) catch return error.OutOfMemory;
    }
    return copy;
}

// -- Types --

pub const DiffChunk = struct {
    id: []const u8,
    text: ?[]const u8,
    kv: ?[]const u8,
    removed: bool,
    instance: ?[]const []const u8,
    relates: ?[]const []const u8,

    /// Lean JSON: only emit fields that changed.
    pub fn jsonStringify(self: *const DiffChunk, jw: anytype) !void {
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
            if (self.instance) |inst| {
                try jw.objectField("instance");
                try jw.write(inst);
            }
            if (self.relates) |rel| {
                try jw.objectField("relates");
                try jw.write(rel);
            }
        }

        try jw.endObject();
    }
};

pub const DiffResult = struct {
    from: []const u8,
    to: []const u8,
    chunks: []DiffChunk,

    pub fn deinit(self: *DiffResult, allocator: std.mem.Allocator) void {
        for (self.chunks) |ch| {
            allocator.free(ch.id);
            if (ch.text) |t| allocator.free(t);
            if (ch.kv) |k| allocator.free(k);
            if (ch.instance) |inst| {
                for (inst) |d| allocator.free(d);
                allocator.free(inst);
            }
            if (ch.relates) |rel| {
                for (rel) |d| allocator.free(d);
                allocator.free(rel);
            }
        }
        allocator.free(self.chunks);
        allocator.free(self.from);
        allocator.free(self.to);
    }
};

// ============================================================
// Tests
// ============================================================

const apply = @import("apply.zig");

test "diff detects new chunks" {
    var db = try Db.initTestDb();
    defer db.close();

    // get root commit (empty state)
    const root = try db.getHead("main");

    // apply a chunk
    var r = try apply.run(&db, std.testing.allocator, "main",
        \\{"chunks":[{"text":"hello","instance":["alpha"]}]}
    );
    defer r.deinit(std.testing.allocator);

    // diff root → HEAD
    const head = try db.getHead("main");
    var result = try run(&db, std.testing.allocator, &root, &head);
    defer result.deinit(std.testing.allocator);

    // should show 1 new chunk
    try std.testing.expectEqual(@as(usize, 1), result.chunks.len);
    try std.testing.expect(result.chunks[0].text != null);
    try std.testing.expectEqualStrings("hello", result.chunks[0].text.?);
    try std.testing.expect(!result.chunks[0].removed);
}

test "diff detects removed chunks" {
    var db = try Db.initTestDb();
    defer db.close();

    // create a chunk
    var r1 = try apply.run(&db, std.testing.allocator, "main",
        \\{"chunks":[{"text":"ephemeral","instance":["temp"]}]}
    );
    defer r1.deinit(std.testing.allocator);
    const after_create = try db.getHead("main");

    // remove it
    var id_buf: [60]u8 = undefined;
    const id_hex = std.fmt.bufPrint(&id_buf, "{s}", .{@as([]const u8, &r1.created_ids[0])}) catch unreachable;
    var json_buf: [256]u8 = undefined;
    const remove_json = std.fmt.bufPrint(&json_buf, "{{\"chunks\":[{{\"id\":\"{s}\",\"removed\":true}}]}}", .{id_hex}) catch unreachable;

    var r2 = try apply.run(&db, std.testing.allocator, "main", remove_json);
    defer r2.deinit(std.testing.allocator);
    const after_remove = try db.getHead("main");

    // diff create → remove
    var result = try run(&db, std.testing.allocator, &after_create, &after_remove);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 1), result.chunks.len);
    try std.testing.expect(result.chunks[0].removed);
}

test "diff detects text changes" {
    var db = try Db.initTestDb();
    defer db.close();

    // create
    var r1 = try apply.run(&db, std.testing.allocator, "main",
        \\{"chunks":[{"text":"original","instance":["dim1"]}]}
    );
    defer r1.deinit(std.testing.allocator);
    const after_create = try db.getHead("main");

    // update text
    var id_buf: [60]u8 = undefined;
    const id_hex = std.fmt.bufPrint(&id_buf, "{s}", .{@as([]const u8, &r1.created_ids[0])}) catch unreachable;
    var json_buf: [256]u8 = undefined;
    const update_json = std.fmt.bufPrint(&json_buf, "{{\"chunks\":[{{\"id\":\"{s}\",\"text\":\"revised\"}}]}}", .{id_hex}) catch unreachable;

    var r2 = try apply.run(&db, std.testing.allocator, "main", update_json);
    defer r2.deinit(std.testing.allocator);
    const after_update = try db.getHead("main");

    // diff
    var result = try run(&db, std.testing.allocator, &after_create, &after_update);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 1), result.chunks.len);
    try std.testing.expect(!result.chunks[0].removed);
    try std.testing.expectEqualStrings("revised", result.chunks[0].text.?);
    // kv didn't change, should be null
    try std.testing.expect(result.chunks[0].kv == null);
}

test "diff returns empty for identical states" {
    var db = try Db.initTestDb();
    defer db.close();

    var r = try apply.run(&db, std.testing.allocator, "main",
        \\{"chunks":[{"text":"stable","instance":["dim1"]}]}
    );
    defer r.deinit(std.testing.allocator);

    const head = try db.getHead("main");
    var result = try run(&db, std.testing.allocator, &head, &head);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 0), result.chunks.len);
}
