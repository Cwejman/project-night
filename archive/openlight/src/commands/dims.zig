const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;

/// List all dimensions with instance/relates/total counts on the current branch.
pub fn run(db: *Db, allocator: std.mem.Allocator, head: []const u8) Error![]DimInfo {
    try db.materializeCurrentState(head);
    defer db.dropCurrentState();

    var stmt = try db.prepare(
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

// -- Types --

pub const DimInfo = struct {
    name: []const u8,
    instance: i32,
    relates: i32,
    total: i32,
};

pub fn freeDimInfos(allocator: std.mem.Allocator, dims: []DimInfo) void {
    for (dims) |dim| {
        allocator.free(dim.name);
    }
    allocator.free(dims);
}

// ============================================================
// Tests
// ============================================================

const apply = @import("apply.zig");

test "dims returns correct counts" {
    var db = try Db.initTestDb();
    defer db.close();

    // 3 chunks across dims: alpha(instance x2), beta(instance x1, relates x1), gamma(relates x1)
    const json =
        \\{"chunks":[
        \\  {"text":"c1","instance":["alpha","beta"]},
        \\  {"text":"c2","instance":["alpha"],"relates":["gamma"]},
        \\  {"text":"c3","relates":["beta"]}
        \\]}
    ;
    var r = try apply.run(&db, std.testing.allocator, "main", json);
    defer r.deinit(std.testing.allocator);

    const dim_list = try run(&db, std.testing.allocator, &(try db.getHead("main")));
    defer freeDimInfos(std.testing.allocator, dim_list);

    // sorted: alpha, beta, gamma
    try std.testing.expectEqual(@as(usize, 3), dim_list.len);
    try std.testing.expectEqualStrings("alpha", dim_list[0].name);
    try std.testing.expectEqual(@as(c_int, 2), dim_list[0].instance);
    try std.testing.expectEqual(@as(c_int, 0), dim_list[0].relates);
    try std.testing.expectEqual(@as(c_int, 2), dim_list[0].total);

    try std.testing.expectEqualStrings("beta", dim_list[1].name);
    try std.testing.expectEqual(@as(c_int, 1), dim_list[1].instance);
    try std.testing.expectEqual(@as(c_int, 1), dim_list[1].relates);
    try std.testing.expectEqual(@as(c_int, 2), dim_list[1].total);

    try std.testing.expectEqualStrings("gamma", dim_list[2].name);
    try std.testing.expectEqual(@as(c_int, 0), dim_list[2].instance);
    try std.testing.expectEqual(@as(c_int, 1), dim_list[2].relates);
    try std.testing.expectEqual(@as(c_int, 1), dim_list[2].total);
}

test "dims across multiple applies" {
    var db = try Db.initTestDb();
    defer db.close();

    const json1 =
        \\{"chunks":[{"text":"first","instance":["alpha"],"relates":["beta"]}]}
    ;
    var r1 = try apply.run(&db, std.testing.allocator, "main", json1);
    defer r1.deinit(std.testing.allocator);

    const json2 =
        \\{"chunks":[{"text":"second","instance":["alpha","gamma"]}]}
    ;
    var r2 = try apply.run(&db, std.testing.allocator, "main", json2);
    defer r2.deinit(std.testing.allocator);

    const dim_list = try run(&db, std.testing.allocator, &(try db.getHead("main")));
    defer freeDimInfos(std.testing.allocator, dim_list);

    // 3 dims: alpha(inst=2), beta(rel=1), gamma(inst=1)
    try std.testing.expectEqual(@as(usize, 3), dim_list.len);
    try std.testing.expectEqualStrings("alpha", dim_list[0].name);
    try std.testing.expectEqual(@as(c_int, 2), dim_list[0].instance);

    try std.testing.expectEqualStrings("beta", dim_list[1].name);
    try std.testing.expectEqual(@as(c_int, 1), dim_list[1].relates);

    try std.testing.expectEqualStrings("gamma", dim_list[2].name);
    try std.testing.expectEqual(@as(c_int, 1), dim_list[2].instance);
}

