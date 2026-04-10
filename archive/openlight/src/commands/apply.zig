const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

/// Apply a declarative JSON mutation.
/// Parses input, creates a commit, processes each chunk, advances HEAD.
pub fn run(db: *Db, allocator: std.mem.Allocator, branch: []const u8, json_input: []const u8) Error!ApplyResult {
    const parsed = std.json.parseFromSlice(std.json.Value, allocator, json_input, .{}) catch return error.InvalidInput;
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) return error.InvalidInput;
    const chunks_val = root.object.get("chunks") orelse return error.InvalidInput;
    if (chunks_val != .array) return error.InvalidInput;

    // begin transaction
    try db.exec("BEGIN IMMEDIATE");
    errdefer db.exec("ROLLBACK") catch {};

    const parent_id = try db.getHead(branch);
    const commit_id = try db.createCommit(&parent_id);

    // process each chunk
    var created_ids: std.ArrayListAligned([20]u8, null) = .{};
    defer created_ids.deinit(allocator);

    for (chunks_val.array.items) |chunk_val| {
        if (chunk_val != .object) return error.InvalidInput;
        const chunk = chunk_val.object;

        const has_id = chunk.get("id");
        const is_removed = if (chunk.get("removed")) |r| r == .bool and r.bool else false;

        if (is_removed) {
            try removeChunk(db, chunk, &commit_id);
        } else if (has_id != null) {
            try updateChunk(db, allocator, chunk, &commit_id);
        } else {
            const new_id = try createChunk(db, allocator, chunk, &commit_id);
            created_ids.append(allocator, new_id) catch return error.OutOfMemory;
        }
    }

    // advance HEAD, commit
    try db.advanceBranch(branch, &commit_id);
    try db.exec("COMMIT");

    return .{
        .commit_id = commit_id,
        .created_ids = created_ids.toOwnedSlice(allocator) catch return error.OutOfMemory,
    };
}

// -- Chunk operations --

fn removeChunk(db: *Db, chunk: std.json.ObjectMap, commit_id: []const u8) Error!void {
    const id = getStringField(chunk, "id") orelse return error.InvalidInput;
    try insertChunkVersion(db, id, commit_id, "", "{}", true);
}

fn createChunk(db: *Db, allocator: std.mem.Allocator, chunk: std.json.ObjectMap, commit_id: []const u8) Error![20]u8 {
    const text = getStringField(chunk, "text") orelse return error.InvalidInput;

    // kv
    const kv_owned = if (chunk.get("kv")) |kv_val| try serializeKv(allocator, kv_val) else null;
    defer if (kv_owned) |owned| allocator.free(owned);
    const kv = kv_owned orelse "{}";

    // memberships — must have at least one
    const instance_dims = getArrayField(chunk, "instance");
    const relates_dims = getArrayField(chunk, "relates");
    const i_count: usize = if (instance_dims) |d| d.len else 0;
    const r_count: usize = if (relates_dims) |d| d.len else 0;
    if (i_count + r_count == 0) return error.InvalidInput;

    // write
    const chunk_id = Db.generateId();
    try insertChunkVersion(db, &chunk_id, commit_id, text, kv, false);
    try insertMemberships(db, &chunk_id, instance_dims, "instance", commit_id);
    try insertMemberships(db, &chunk_id, relates_dims, "relates", commit_id);

    return chunk_id;
}

fn updateChunk(db: *Db, allocator: std.mem.Allocator, chunk: std.json.ObjectMap, commit_id: []const u8) Error!void {
    const chunk_id = getStringField(chunk, "id") orelse return error.InvalidInput;

    // text / kv — only write a new version if something changed
    const new_text = getStringField(chunk, "text");
    const kv_owned = if (chunk.get("kv")) |kv_val| try serializeKv(allocator, kv_val) else null;
    defer if (kv_owned) |owned| allocator.free(owned);
    const new_kv: ?[]const u8 = kv_owned;

    if (new_text != null or new_kv != null) {
        try updateChunkVersion(db, chunk_id, commit_id, new_text, new_kv);
    }

    // memberships — only diff if provided
    const new_instance = getArrayField(chunk, "instance");
    const new_relates = getArrayField(chunk, "relates");

    if (new_instance != null or new_relates != null) {
        try diffMemberships(db, allocator, chunk_id, commit_id, new_instance, new_relates);
    }
}

// -- Chunk version helpers --

fn updateChunkVersion(db: *Db, chunk_id: []const u8, commit_id: []const u8, new_text: ?[]const u8, new_kv: ?[]const u8) Error!void {
    var cur = try db.prepare("SELECT text, kv FROM chunk_versions WHERE chunk_id = ?1 ORDER BY rowid DESC LIMIT 1");
    defer cur.finalize();
    try cur.bindSlice(1, chunk_id);

    if (try cur.step()) {
        try insertChunkVersion(
            db,
            chunk_id,
            commit_id,
            new_text orelse cur.columnText(0) orelse "",
            new_kv orelse cur.columnText(1) orelse "{}",
            false,
        );
    }
}

fn insertChunkVersion(db: *Db, chunk_id: []const u8, commit_id: []const u8, text: []const u8, kv: []const u8, removed: bool) Error!void {
    var stmt = try db.prepare("INSERT INTO chunk_versions (chunk_id, commit_id, text, kv, removed) VALUES (?1, ?2, ?3, ?4, ?5)");
    defer stmt.finalize();
    try stmt.bindSlice(1, chunk_id);
    try stmt.bindSlice(2, commit_id);
    try stmt.bindSlice(3, text);
    try stmt.bindSlice(4, kv);
    try stmt.bindInt(5, if (removed) 1 else 0);
    _ = try stmt.step();
}

// -- Membership helpers --

fn insertMemberships(db: *Db, chunk_id: []const u8, dims: ?[]const std.json.Value, mem_type: []const u8, commit_id: []const u8) Error!void {
    const items = dims orelse return;
    for (items) |dim_val| {
        if (dim_val != .string) return error.InvalidInput;
        try insertMembership(db, chunk_id, dim_val.string, mem_type, true, commit_id);
    }
}

fn insertMembership(db: *Db, chunk_id: []const u8, dimension: []const u8, mem_type: []const u8, active: bool, commit_id: []const u8) Error!void {
    var stmt = try db.prepare("INSERT INTO membership_versions (chunk_id, dimension, type, active, commit_id) VALUES (?1, ?2, ?3, ?4, ?5)");
    defer stmt.finalize();
    try stmt.bindSlice(1, chunk_id);
    try stmt.bindSlice(2, dimension);
    try stmt.bindSlice(3, mem_type);
    try stmt.bindInt(4, if (active) 1 else 0);
    try stmt.bindSlice(5, commit_id);
    _ = try stmt.step();
}

/// Compare old memberships against new, insert version rows for changes only.
fn diffMemberships(
    db: *Db,
    allocator: std.mem.Allocator,
    chunk_id: []const u8,
    commit_id: []const u8,
    new_instance: ?[]const std.json.Value,
    new_relates: ?[]const std.json.Value,
) Error!void {
    // load current memberships
    var old_instance = std.StringHashMap(void).init(allocator);
    defer old_instance.deinit();
    var old_relates = std.StringHashMap(void).init(allocator);
    defer old_relates.deinit();

    var cur_mem = try db.prepare(
        \\SELECT dimension, type FROM membership_versions
        \\WHERE chunk_id = ?1 AND rowid IN (
        \\  SELECT MAX(rowid) FROM membership_versions WHERE chunk_id = ?1 GROUP BY dimension
        \\) AND active = 1
    );
    defer cur_mem.finalize();
    try cur_mem.bindSlice(1, chunk_id);

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

    // apply diffs for each type
    try diffOneType(db, chunk_id, commit_id, "instance", new_instance, &old_instance, &old_relates, new_relates);
    try diffOneType(db, chunk_id, commit_id, "relates", new_relates, &old_relates, &old_instance, new_instance);
}

/// Diff one membership type (instance or relates) against old state.
/// Adds new, handles type changes, deactivates removed.
fn diffOneType(
    db: *Db,
    chunk_id: []const u8,
    commit_id: []const u8,
    mem_type: []const u8,
    new_dims: ?[]const std.json.Value,
    old_same: *std.StringHashMap(void),
    _: *std.StringHashMap(void),
    new_other: ?[]const std.json.Value,
) Error!void {
    const dims = new_dims orelse return;

    // activate new or changed memberships
    for (dims) |dim_val| {
        if (dim_val != .string) return error.InvalidInput;
        const dim = dim_val.string;

        if (!old_same.contains(dim)) {
            // new membership or type change from other type
            try insertMembership(db, chunk_id, dim, mem_type, true, commit_id);
        }
    }

    // deactivate memberships no longer in this type
    var it = old_same.keyIterator();
    while (it.next()) |key| {
        if (!jsonArrayContains(dims, key.*) and !jsonArrayContains(new_other, key.*)) {
            try insertMembership(db, chunk_id, key.*, mem_type, false, commit_id);
        }
    }
}

// -- JSON helpers --

fn getStringField(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const val = obj.get(key) orelse return null;
    return if (val == .string) val.string else null;
}

fn getArrayField(obj: std.json.ObjectMap, key: []const u8) ?[]const std.json.Value {
    const val = obj.get(key) orelse return null;
    return if (val == .array) val.array.items else null;
}

fn jsonArrayContains(arr: ?[]const std.json.Value, needle: []const u8) bool {
    const items = arr orelse return false;
    for (items) |v| {
        if (v == .string and std.mem.eql(u8, v.string, needle)) return true;
    }
    return false;
}

fn serializeKv(allocator: std.mem.Allocator, kv_val: std.json.Value) Error!?[]const u8 {
    if (kv_val != .object) return null;
    return std.json.Stringify.valueAlloc(allocator, kv_val, .{}) catch return error.OutOfMemory;
}

// -- Types --

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

// ============================================================
// Tests
// ============================================================

const dims_mod = @import("dims.zig");
const scope_mod = @import("scope.zig");

test "apply creates new chunks with memberships" {
    var db = try Db.initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[{"text":"hello","kv":{"priority":"high"},"instance":["culture"],"relates":["projects"]}]}
    ;

    var result = try run(&db, std.testing.allocator, "main", json);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 1), result.created_ids.len);

    // verify chunk_versions row
    var cv = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE removed = 0");
    defer cv.finalize();
    _ = try cv.step();
    try std.testing.expectEqual(@as(c_int, 1), cv.columnInt(0));

    // verify membership_versions rows
    var mv = try db.prepare("SELECT COUNT(*) FROM membership_versions WHERE active = 1");
    defer mv.finalize();
    _ = try mv.step();
    try std.testing.expectEqual(@as(c_int, 2), mv.columnInt(0));
}

test "apply creates commit and advances HEAD" {
    var db = try Db.initTestDb();
    defer db.close();

    const old_head = try db.getHead("main");

    const json =
        \\{"chunks":[{"text":"test","instance":["dim1"]}]}
    ;
    var result = try run(&db, std.testing.allocator, "main", json);
    defer result.deinit(std.testing.allocator);

    // HEAD should have moved
    const new_head = try db.getHead("main");
    try std.testing.expect(!std.mem.eql(u8, &old_head, &new_head));

    // new commit should have old HEAD as parent
    var stmt = try db.prepare("SELECT parent_id FROM commits WHERE id = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, &new_head);
    try std.testing.expect(try stmt.step());
    const parent = stmt.columnText(0).?;
    try std.testing.expectEqualStrings(&old_head, parent);
}

test "apply rejects chunk without membership" {
    var db = try Db.initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[{"text":"no dims"}]}
    ;
    const result = run(&db, std.testing.allocator, "main", json);
    try std.testing.expectError(error.InvalidInput, result);
}

test "apply multiple chunks in one mutation" {
    var db = try Db.initTestDb();
    defer db.close();

    const json =
        \\{"chunks":[{"text":"first","instance":["a"]},{"text":"second","instance":["b"]}]}
    ;
    var result = try run(&db, std.testing.allocator, "main", json);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 2), result.created_ids.len);

    var cv = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE removed = 0");
    defer cv.finalize();
    _ = try cv.step();
    try std.testing.expectEqual(@as(c_int, 2), cv.columnInt(0));
}

test "apply reuses existing dimensions" {
    var db = try Db.initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"first","instance":["shared"]}]}
    ;
    var r1 = try run(&db, std.testing.allocator, "main", json1);
    defer r1.deinit(std.testing.allocator);

    const json2 =
        \\{"chunks":[{"text":"second","instance":["shared"]}]}
    ;
    var r2 = try run(&db, std.testing.allocator, "main", json2);
    defer r2.deinit(std.testing.allocator);

    // dims should show one dimension with count 2
    const dim_list = try dims_mod.run(&db, std.testing.allocator, &(try db.getHead("main")));
    defer dims_mod.freeDimInfos(std.testing.allocator, dim_list);

    try std.testing.expectEqual(@as(usize, 1), dim_list.len);
    try std.testing.expectEqualStrings("shared", dim_list[0].name);
    try std.testing.expectEqual(@as(c_int, 2), dim_list[0].instance);
}

test "apply update changes text" {
    var db = try Db.initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"original","instance":["dim1"]}]}
    ;
    var r1 = try run(&db, std.testing.allocator, "main", json1);
    defer r1.deinit(std.testing.allocator);

    // build update JSON with the created id
    var id_buf: [60]u8 = undefined;
    const id_hex = std.fmt.bufPrint(&id_buf, "{s}", .{@as([]const u8, &r1.created_ids[0])}) catch unreachable;
    var json_buf: [256]u8 = undefined;
    const json2 = std.fmt.bufPrint(&json_buf, "{{\"chunks\":[{{\"id\":\"{s}\",\"text\":\"updated\"}}]}}", .{id_hex}) catch unreachable;

    var r2 = try run(&db, std.testing.allocator, "main", json2);
    defer r2.deinit(std.testing.allocator);

    // verify new text exists
    var stmt = try db.prepare("SELECT text FROM chunk_versions WHERE chunk_id = ?1 ORDER BY rowid DESC LIMIT 1");
    defer stmt.finalize();
    try stmt.bindSlice(1, &r1.created_ids[0]);
    try std.testing.expect(try stmt.step());
    try std.testing.expectEqualStrings("updated", stmt.columnText(0).?);

    // verify old version preserved
    var count_stmt = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE chunk_id = ?1");
    defer count_stmt.finalize();
    try count_stmt.bindSlice(1, &r1.created_ids[0]);
    _ = try count_stmt.step();
    try std.testing.expectEqual(@as(c_int, 2), count_stmt.columnInt(0));
}

test "apply update changes membership" {
    var db = try Db.initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"thing","instance":["culture"],"relates":["projects"]}]}
    ;
    var r1 = try run(&db, std.testing.allocator, "main", json1);
    defer r1.deinit(std.testing.allocator);

    // update: change memberships
    var id_buf: [60]u8 = undefined;
    const id_hex = std.fmt.bufPrint(&id_buf, "{s}", .{@as([]const u8, &r1.created_ids[0])}) catch unreachable;
    var json_buf: [256]u8 = undefined;
    const json2 = std.fmt.bufPrint(&json_buf, "{{\"chunks\":[{{\"id\":\"{s}\",\"instance\":[\"people\"],\"relates\":[\"education\"]}}]}}", .{id_hex}) catch unreachable;

    var r2 = try run(&db, std.testing.allocator, "main", json2);
    defer r2.deinit(std.testing.allocator);

    // verify via scope
    const scope_dims = [_][]const u8{"people"};
    var sr = try scope_mod.run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, true);
    defer sr.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(i32, 1), sr.in_scope);
}

test "apply remove marks chunk as removed" {
    var db = try Db.initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"ephemeral","instance":["temp"]}]}
    ;
    var r1 = try run(&db, std.testing.allocator, "main", json1);
    defer r1.deinit(std.testing.allocator);

    // remove it
    var id_buf: [60]u8 = undefined;
    const id_hex = std.fmt.bufPrint(&id_buf, "{s}", .{@as([]const u8, &r1.created_ids[0])}) catch unreachable;
    var json_buf: [256]u8 = undefined;
    const json2 = std.fmt.bufPrint(&json_buf, "{{\"chunks\":[{{\"id\":\"{s}\",\"removed\":true}}]}}", .{id_hex}) catch unreachable;

    var r2 = try run(&db, std.testing.allocator, "main", json2);
    defer r2.deinit(std.testing.allocator);

    // verify not in scope
    const scope_dims = [_][]const u8{"temp"};
    var sr = try scope_mod.run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer sr.deinit(std.testing.allocator);
    try std.testing.expectEqual(@as(i32, 0), sr.in_scope);

    // verify version history preserved (2 versions: create + remove)
    var stmt = try db.prepare("SELECT COUNT(*) FROM chunk_versions WHERE chunk_id = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, &r1.created_ids[0]);
    _ = try stmt.step();
    try std.testing.expectEqual(@as(c_int, 2), stmt.columnInt(0));
}

