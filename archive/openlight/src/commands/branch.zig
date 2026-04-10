const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

/// Create a new branch pointing at the active branch's HEAD.
pub fn create(db: *Db, active_branch: []const u8, name: []const u8) Error!void {
    const head = try db.getHead(active_branch);

    var stmt = try db.prepare("INSERT INTO branches (name, head) VALUES (?1, ?2)");
    defer stmt.finalize();
    try stmt.bindSlice(1, name);
    try stmt.bindSlice(2, &head);
    _ = try stmt.step();
}

/// List all branches with their HEAD commit ids.
pub fn list(db: *Db, allocator: std.mem.Allocator) Error![]BranchInfo {
    var stmt = try db.prepare("SELECT name, head FROM branches ORDER BY name");
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

/// Delete a branch. Cannot delete main or the active branch.
pub fn delete(db: *Db, active_branch: []const u8, name: []const u8) Error!void {
    if (std.mem.eql(u8, name, "main")) return error.InvalidInput;
    if (std.mem.eql(u8, name, active_branch)) return error.InvalidInput;

    var stmt = try db.prepare("DELETE FROM branches WHERE name = ?1");
    defer stmt.finalize();
    try stmt.bindSlice(1, name);
    _ = try stmt.step();
}

// -- Types --

pub const BranchInfo = struct {
    name: []const u8,
    head: []const u8,
};

pub fn freeBranchInfos(allocator: std.mem.Allocator, branches: []BranchInfo) void {
    for (branches) |b| {
        allocator.free(b.name);
        allocator.free(b.head);
    }
    allocator.free(branches);
}

// ============================================================
// Tests
// ============================================================

test "branch isolates state between branches" {
    var db = try Db.initTestDb();
    defer db.close();

    const apply = @import("apply.zig");
    const dims_mod = @import("dims.zig");

    // apply on main
    const json1 =
        \\{"chunks":[{"text":"on main","instance":["alpha"]}]}
    ;
    var r1 = try apply.run(&db, std.testing.allocator, "main", json1);
    defer r1.deinit(std.testing.allocator);

    // create feature branch (forks from main)
    try create(&db, "main", "feature");

    // apply on feature branch
    const json2 =
        \\{"chunks":[{"text":"on feature","instance":["beta"]}]}
    ;
    var r2 = try apply.run(&db, std.testing.allocator, "feature", json2);
    defer r2.deinit(std.testing.allocator);

    // feature should see both dimensions
    const dims_feature = try dims_mod.run(&db, std.testing.allocator, &(try db.getHead("feature")));
    defer dims_mod.freeDimInfos(std.testing.allocator, dims_feature);
    try std.testing.expectEqual(dims_feature.len, 2);

    // main should only see alpha
    const dims_main = try dims_mod.run(&db, std.testing.allocator, &(try db.getHead("main")));
    defer dims_mod.freeDimInfos(std.testing.allocator, dims_main);
    try std.testing.expectEqual(dims_main.len, 1);
    try std.testing.expectEqualStrings("alpha", dims_main[0].name);
}
