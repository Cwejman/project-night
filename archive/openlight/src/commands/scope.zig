const std = @import("std");
const Db = @import("../db.zig");
const Error = Db.Error;
const Statement = Db.Statement;

/// Navigate the dimensional space.
/// Given scope dimensions, finds in-scope chunks, connected dimensions, and connections between them.
/// Empty scope returns all dimensions with connections.
pub fn run(db: *Db, allocator: std.mem.Allocator, head: []const u8, scope_dims: []const []const u8, include_chunks: bool) Error!ScopeResult {

    // resolve current state
    try db.materializeCurrentState(head);
    defer db.dropCurrentState();

    // total chunks
    const total_chunks = try countRows(db, "SELECT COUNT(*) FROM cur_chunks");

    // scoped query
    if (scope_dims.len > 0) {
        try populateScopeFilter(db, scope_dims);
        defer db.exec("DROP TABLE IF EXISTS scope_filter") catch {};

        try createInScopeTable(db, scope_dims.len);
        defer db.exec("DROP TABLE IF EXISTS in_scope") catch {};

        const in_scope_count = try countRows(db, "SELECT COUNT(*) FROM in_scope");
        const ir = try countInstanceRelates(db);

        var dim_counts = try queryConnectedDims(db, allocator);
        defer freeDimCounts(allocator, &dim_counts);

        var connections = try queryConnections(db, allocator);
        defer freeConnectionMap(allocator, &connections);

        var edges = try queryEdges(db, allocator, &dim_counts);
        defer freeConnectionMap(allocator, &edges);

        return buildResult(allocator, .{
            .scope_dims = scope_dims,
            .head = head,
            .total = total_chunks,
            .in_scope = in_scope_count,
            .instance = ir.instance,
            .relates = ir.relates,
            .dim_counts = &dim_counts,
            .connections = &connections,
            .edges = &edges,
            .items = if (include_chunks) try fetchChunkItems(db, allocator, "SELECT chunk_id FROM in_scope") else null,
        });
    }

    // empty scope — all dimensions, all connections
    var dim_counts = try queryAllDims(db, allocator);
    defer freeDimCounts(allocator, &dim_counts);

    var connections = try queryAllConnections(db, allocator);
    defer freeConnectionMap(allocator, &connections);

    return buildResult(allocator, .{
        .scope_dims = &.{},
        .head = head,
        .total = total_chunks,
        .in_scope = total_chunks,
        .instance = 0,
        .relates = 0,
        .dim_counts = &dim_counts,
        .connections = &connections,
        .items = if (include_chunks) try fetchChunkItems(db, allocator, "SELECT chunk_id FROM cur_chunks") else null,
    });
}

// -- Scope filter setup --

fn populateScopeFilter(db: *Db, scope_dims: []const []const u8) Error!void {
    try db.exec("CREATE TEMP TABLE scope_filter (name TEXT)");
    var ins = try db.prepare("INSERT INTO scope_filter VALUES (?1)");
    defer ins.finalize();
    for (scope_dims) |dim| {
        try ins.bindSlice(1, dim);
        _ = try ins.step();
        try ins.reset();
    }
}

fn createInScopeTable(db: *Db, dim_count: usize) Error!void {
    var stmt = try db.prepare(
        \\CREATE TEMP TABLE in_scope AS
        \\SELECT chunk_id FROM cur_memberships
        \\WHERE dimension IN (SELECT name FROM scope_filter)
        \\GROUP BY chunk_id HAVING COUNT(DISTINCT dimension) = ?1
    );
    defer stmt.finalize();
    try stmt.bindInt(1, @intCast(dim_count));
    _ = try stmt.step();
}

// -- Counting queries --

fn countRows(db: *Db, sql: [*:0]const u8) Error!i32 {
    var stmt = try db.prepare(sql);
    defer stmt.finalize();
    _ = try stmt.step();
    return stmt.columnInt(0);
}

fn countInstanceRelates(db: *Db) Error!struct { instance: i32, relates: i32 } {
    var stmt = try db.prepare(
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
    defer stmt.finalize();
    if (try stmt.step()) {
        return .{ .instance = stmt.columnInt(0), .relates = stmt.columnInt(1) };
    }
    return .{ .instance = 0, .relates = 0 };
}

// -- Dimension queries (scoped vs all) --

fn queryConnectedDims(db: *Db, allocator: std.mem.Allocator) Error!std.StringHashMap(DimCounts) {
    var stmt = try db.prepare(
        \\SELECT cm.dimension, cm.type, COUNT(DISTINCT cm.chunk_id)
        \\FROM cur_memberships cm
        \\INNER JOIN in_scope isc ON isc.chunk_id = cm.chunk_id
        \\WHERE cm.dimension NOT IN (SELECT name FROM scope_filter)
        \\GROUP BY cm.dimension, cm.type ORDER BY cm.dimension
    );
    defer stmt.finalize();
    return collectDimCounts(allocator, &stmt);
}

fn queryAllDims(db: *Db, allocator: std.mem.Allocator) Error!std.StringHashMap(DimCounts) {
    var stmt = try db.prepare(
        \\SELECT dimension, type, COUNT(DISTINCT chunk_id)
        \\FROM cur_memberships GROUP BY dimension, type ORDER BY dimension
    );
    defer stmt.finalize();
    return collectDimCounts(allocator, &stmt);
}

fn queryConnections(db: *Db, allocator: std.mem.Allocator) Error!ConnMap {
    var stmt = try db.prepare(
        \\SELECT cm1.dimension, cm2.dimension, cm2.type, COUNT(DISTINCT cm1.chunk_id)
        \\FROM cur_memberships cm1
        \\JOIN cur_memberships cm2 ON cm1.chunk_id = cm2.chunk_id
        \\JOIN in_scope ON in_scope.chunk_id = cm1.chunk_id
        \\WHERE cm1.dimension NOT IN (SELECT name FROM scope_filter)
        \\AND cm2.dimension NOT IN (SELECT name FROM scope_filter)
        \\AND cm1.dimension != cm2.dimension
        \\GROUP BY cm1.dimension, cm2.dimension, cm2.type
    );
    defer stmt.finalize();
    return collectConnections(allocator, &stmt);
}

fn queryAllConnections(db: *Db, allocator: std.mem.Allocator) Error!ConnMap {
    var stmt = try db.prepare(
        \\SELECT cm1.dimension, cm2.dimension, cm2.type, COUNT(DISTINCT cm1.chunk_id)
        \\FROM cur_memberships cm1
        \\JOIN cur_memberships cm2 ON cm1.chunk_id = cm2.chunk_id
        \\WHERE cm1.dimension != cm2.dimension
        \\GROUP BY cm1.dimension, cm2.dimension, cm2.type
    );
    defer stmt.finalize();
    return collectConnections(allocator, &stmt);
}

// -- Edge queries --

/// Edges: for each connected dim, find dimensions that in-scope chunks on that
/// connected dim also touch, but that are NOT in scope and NOT already connected.
fn queryEdges(db: *Db, allocator: std.mem.Allocator, connected_dims: *std.StringHashMap(DimCounts)) Error!ConnMap {

    // populate temp table with connected dim names
    try db.exec("CREATE TEMP TABLE connected_dims (name TEXT)");
    {
        var ins = try db.prepare("INSERT INTO connected_dims VALUES (?1)");
        defer ins.finalize();

        var it = connected_dims.keyIterator();
        while (it.next()) |key| {
            try ins.bindSlice(1, key.*);
            _ = try ins.step();
            try ins.reset();
        }
    }

    // query: for each connected dim (cm1), find dims (cm2) reached through
    // ALL chunks on that connected dim (not just in-scope), where cm2 is
    // NOT in scope and NOT already connected
    var stmt = try db.prepare(
        \\SELECT cm1.dimension, cm2.dimension, cm2.type, COUNT(DISTINCT cm1.chunk_id)
        \\FROM cur_memberships cm1
        \\JOIN cur_memberships cm2 ON cm1.chunk_id = cm2.chunk_id
        \\WHERE cm1.dimension IN (SELECT name FROM connected_dims)
        \\AND cm2.dimension NOT IN (SELECT name FROM scope_filter)
        \\AND cm2.dimension NOT IN (SELECT name FROM connected_dims)
        \\AND cm1.dimension != cm2.dimension
        \\GROUP BY cm1.dimension, cm2.dimension, cm2.type
    );
    defer stmt.finalize();

    const result = try collectConnections(allocator, &stmt);

    db.exec("DROP TABLE IF EXISTS connected_dims") catch {};

    return result;
}

// -- Result assembly --

fn buildResult(allocator: std.mem.Allocator, p: struct {
    scope_dims: []const []const u8,
    head: []const u8,
    total: i32,
    in_scope: i32,
    instance: i32,
    relates: i32,
    dim_counts: *std.StringHashMap(DimCounts),
    connections: *ConnMap,
    edges: ?*ConnMap = null,
    items: ?[]ScopeResult.ChunkItem,
}) Error!ScopeResult {
    const dimensions = try buildScopeDims(allocator, p.dim_counts, p.connections, p.edges);

    // Sort dimensions by shared count descending (most connected first)
    std.mem.sortUnstable(ScopeResult.ScopeDim, dimensions, {}, struct {
        fn lessThan(_: void, a: ScopeResult.ScopeDim, b: ScopeResult.ScopeDim) bool {
            return a.shared > b.shared;
        }
    }.lessThan);

    const scope_copy = allocator.alloc([]const u8, p.scope_dims.len) catch return error.OutOfMemory;
    for (p.scope_dims, 0..) |dim, i| {
        scope_copy[i] = allocator.dupe(u8, dim) catch return error.OutOfMemory;
    }

    return .{
        .scope = scope_copy,
        .head = allocator.dupe(u8, p.head) catch return error.OutOfMemory,
        .total_chunks = p.total,
        .in_scope = p.in_scope,
        .in_scope_instance = p.instance,
        .in_scope_relates = p.relates,
        .dimensions = dimensions,
        .items = p.items,
    };
}

// -- Row collectors --

const DimCounts = struct { instance: i32, relates: i32 };
const ConnMap = std.StringHashMap(std.StringHashMap(DimCounts));

fn collectDimCounts(allocator: std.mem.Allocator, stmt: *Statement) Error!std.StringHashMap(DimCounts) {
    var map = std.StringHashMap(DimCounts).init(allocator);
    errdefer freeDimCounts(allocator, &map);

    while (try stmt.step()) {
        const name = stmt.columnText(0) orelse continue;
        const mtype = stmt.columnText(1) orelse continue;
        const count = stmt.columnInt(2);

        const key = allocator.dupe(u8, name) catch return error.OutOfMemory;
        const gop = map.getOrPut(key) catch { allocator.free(key); return error.OutOfMemory; };
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

fn collectConnections(allocator: std.mem.Allocator, stmt: *Statement) Error!ConnMap {
    var map = ConnMap.init(allocator);
    errdefer freeConnectionMap(allocator, &map);

    while (try stmt.step()) {
        const d1 = stmt.columnText(0) orelse continue;
        const d2 = stmt.columnText(1) orelse continue;
        const ctype = stmt.columnText(2) orelse continue;
        const ccount = stmt.columnInt(3);

        const d1_key = allocator.dupe(u8, d1) catch return error.OutOfMemory;
        const gop = map.getOrPut(d1_key) catch { allocator.free(d1_key); return error.OutOfMemory; };
        if (gop.found_existing) allocator.free(d1_key);
        if (!gop.found_existing) gop.value_ptr.* = std.StringHashMap(DimCounts).init(allocator);

        const d2_key = allocator.dupe(u8, d2) catch return error.OutOfMemory;
        const cgop = gop.value_ptr.getOrPut(d2_key) catch { allocator.free(d2_key); return error.OutOfMemory; };
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

fn buildScopeDims(
    allocator: std.mem.Allocator,
    dim_counts: *std.StringHashMap(DimCounts),
    connections: *ConnMap,
    edges: ?*ConnMap,
) Error![]ScopeResult.ScopeDim {
    var dimensions: std.ArrayListAligned(ScopeResult.ScopeDim, null) = .{};
    defer dimensions.deinit(allocator);

    var it = dim_counts.iterator();
    while (it.next()) |entry| {
        const name = entry.key_ptr.*;
        const counts = entry.value_ptr.*;

        const conns = try collectFromConnMap(allocator, connections, name);
        const edge_conns: []ScopeResult.Connection = if (edges) |e| try collectFromConnMap(allocator, e, name) else try allocator.alloc(ScopeResult.Connection, 0);

        dimensions.append(allocator, .{
            .name = allocator.dupe(u8, name) catch return error.OutOfMemory,
            .shared = counts.instance + counts.relates,
            .instance = counts.instance,
            .relates = counts.relates,
            .connections = conns,
            .edges = edge_conns,
        }) catch return error.OutOfMemory;
    }

    return dimensions.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

fn collectFromConnMap(allocator: std.mem.Allocator, map: *ConnMap, name: []const u8) Error![]ScopeResult.Connection {
    var conns: std.ArrayListAligned(ScopeResult.Connection, null) = .{};
    defer conns.deinit(allocator);

    if (map.get(name)) |*inner| {
        var ci = inner.iterator();
        while (ci.next()) |ce| {
            conns.append(allocator, .{
                .dim = allocator.dupe(u8, ce.key_ptr.*) catch return error.OutOfMemory,
                .instance = ce.value_ptr.instance,
                .relates = ce.value_ptr.relates,
            }) catch return error.OutOfMemory;
        }
    }

    return conns.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

// -- Chunk items --

fn fetchChunkItems(db: *Db, allocator: std.mem.Allocator, chunk_subquery: [*:0]const u8) Error![]ScopeResult.ChunkItem {
    var buf: [512]u8 = undefined;
    const sql = std.fmt.bufPrint(&buf,
        "SELECT c.chunk_id, c.text, c.kv FROM cur_chunks c WHERE c.chunk_id IN ({s}) ORDER BY c.chunk_id",
        .{std.mem.span(chunk_subquery)},
    ) catch return error.OutOfMemory;
    const sql_z = allocator.dupeZ(u8, sql) catch return error.OutOfMemory;
    defer allocator.free(sql_z);

    var stmt = try db.prepare(sql_z.ptr);
    defer stmt.finalize();

    var items: std.ArrayListAligned(ScopeResult.ChunkItem, null) = .{};
    defer items.deinit(allocator);

    while (try stmt.step()) {
        const chunk_id = stmt.columnText(0) orelse continue;
        const text = stmt.columnText(1) orelse "";
        const kv = stmt.columnText(2) orelse "{}";

        var mem_stmt = try db.prepare(
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

// -- Cleanup --

fn freeDimCounts(allocator: std.mem.Allocator, map: *std.StringHashMap(DimCounts)) void {
    var it = map.keyIterator();
    while (it.next()) |k| allocator.free(k.*);
    map.deinit();
}

fn freeConnectionMap(allocator: std.mem.Allocator, map: *ConnMap) void {
    var it = map.iterator();
    while (it.next()) |entry| {
        var inner_it = entry.value_ptr.keyIterator();
        while (inner_it.next()) |k| allocator.free(k.*);
        entry.value_ptr.deinit();
        allocator.free(entry.key_ptr.*);
    }
    map.deinit();
}

// -- Types --

pub const ScopeResult = struct {
    scope: []const []const u8,
    head: []const u8,
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
        edges: []Connection = &.{},
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
            try jw.print("{s}", .{self.kv});
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
        try jw.objectField("head");
        try jw.write(self.head);
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
            for (dim.edges) |edge| allocator.free(edge.dim);
            allocator.free(dim.edges);
            allocator.free(dim.name);
        }
        allocator.free(self.dimensions);
        for (self.scope) |s| allocator.free(s);
        allocator.free(self.scope);
        allocator.free(self.head);
    }
};

// ============================================================
// Tests
// ============================================================

const apply = @import("apply.zig");
const serial = @import("../serial.zig");

fn findDim(dims: []ScopeResult.ScopeDim, name: []const u8) ?ScopeResult.ScopeDim {
    for (dims) |d| {
        if (std.mem.eql(u8, d.name, name)) return d;
    }
    return null;
}

fn findConnection(conns: []ScopeResult.Connection, name: []const u8) ?ScopeResult.Connection {
    for (conns) |c| {
        if (std.mem.eql(u8, c.dim, name)) return c;
    }
    return null;
}

fn setupScopeTestData(db: *Db) !void {
    // chunk 1: instance culture+projects, relates people
    const c1 =
        \\{"chunks":[{"text":"chunk1","instance":["culture","projects"],"relates":["people"]}]}
    ;
    var r1 = try apply.run(db, std.testing.allocator, "main", c1);
    defer r1.deinit(std.testing.allocator);

    // chunk 2: instance culture, relates education
    const c2 =
        \\{"chunks":[{"text":"chunk2","instance":["culture"],"relates":["education"]}]}
    ;
    var r2 = try apply.run(db, std.testing.allocator, "main", c2);
    defer r2.deinit(std.testing.allocator);

    // chunk 3: instance culture+projects
    const c3 =
        \\{"chunks":[{"text":"chunk3","instance":["culture","projects"]}]}
    ;
    var r3 = try apply.run(db, std.testing.allocator, "main", c3);
    defer r3.deinit(std.testing.allocator);
}

test "scope returns connected dimensions with counts" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(i32, 3), result.total_chunks);
    try std.testing.expectEqual(@as(i32, 3), result.in_scope);
    // all 3 chunks have "culture" as instance membership in scope
    try std.testing.expectEqual(@as(i32, 3), result.in_scope_instance);
    try std.testing.expectEqual(@as(i32, 0), result.in_scope_relates);

    // 3 connected dimensions: projects, people, education
    try std.testing.expectEqual(@as(usize, 3), result.dimensions.len);
}

test "scope connections between connected dimensions" {
    var db = try Db.initTestDb();
    defer db.close();

    // chunk 1: instance culture+projects, relates people
    const c1 =
        \\{"chunks":[{"text":"chunk1","instance":["culture","projects"],"relates":["people"]}]}
    ;
    var r1 = try apply.run(&db, std.testing.allocator, "main", c1);
    defer r1.deinit(std.testing.allocator);

    // chunk 2: instance culture
    const c2 =
        \\{"chunks":[{"text":"chunk2","instance":["culture"]}]}
    ;
    var r2 = try apply.run(&db, std.testing.allocator, "main", c2);
    defer r2.deinit(std.testing.allocator);

    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    // projects should have a connection to people
    const projects_dim = findDim(result.dimensions, "projects");
    try std.testing.expect(projects_dim != null);
    const people_conn = findConnection(projects_dim.?.connections, "people");
    try std.testing.expect(people_conn != null);
}

test "scope with narrow intersection" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    // scope to culture+projects: only chunks that have both
    const scope_dims = [_][]const u8{ "culture", "projects" };
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    // chunk1 and chunk3 have both culture+projects; chunk2 only has culture
    try std.testing.expectEqual(@as(i32, 2), result.in_scope);
}

test "scope with --chunks returns chunk items" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, true);
    defer result.deinit(std.testing.allocator);

    try std.testing.expect(result.items != null);
    const items = result.items.?;
    try std.testing.expectEqual(@as(usize, 3), items.len);

    // verify items have memberships
    for (items) |item| {
        try std.testing.expect(item.instance.len + item.relates.len > 0);
    }
}

test "scope without --chunks has no items" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expect(result.items == null);
}

test "empty scope returns all dimensions with connections" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const scope_dims = [_][]const u8{};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    // all 4 dimensions: culture, projects, people, education
    try std.testing.expectEqual(@as(usize, 4), result.dimensions.len);

    // each dimension should have connections (they co-occur)
    for (result.dimensions) |dim| {
        try std.testing.expect(dim.connections.len > 0);
    }
}

test "scoped dimensions sorted by shared count descending" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    // scope culture: connected dims are projects (shared=2), people (shared=1), education (shared=1)
    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 3), result.dimensions.len);

    // first dimension should have highest shared count
    try std.testing.expect(result.dimensions[0].shared >= result.dimensions[1].shared);
    try std.testing.expect(result.dimensions[1].shared >= result.dimensions[2].shared);

    // projects has shared=2 (chunks 1 and 3), so it should be first
    try std.testing.expectEqualStrings("projects", result.dimensions[0].name);
    try std.testing.expectEqual(@as(i32, 2), result.dimensions[0].shared);
}

test "empty scope dimensions sorted by total count descending" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const scope_dims = [_][]const u8{};
    var result = try run(&db, std.testing.allocator, &(try db.getHead("main")), &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    try std.testing.expectEqual(@as(usize, 4), result.dimensions.len);

    // dimensions should be sorted by shared (= total) descending
    for (result.dimensions[0 .. result.dimensions.len - 1], result.dimensions[1..]) |a, b| {
        try std.testing.expect(a.shared >= b.shared);
    }

    // culture has 3 chunks, projects has 2 — culture should be first
    try std.testing.expectEqualStrings("culture", result.dimensions[0].name);
    try std.testing.expectEqual(@as(i32, 3), result.dimensions[0].shared);
}

test "scope result includes head commit id" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const head = try db.getHead("main");
    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &head, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    // head field should match the branch HEAD we passed in
    try std.testing.expectEqualStrings(&head, result.head);
}

test "scope JSON output contains head field" {
    var db = try Db.initTestDb();
    defer db.close();
    try setupScopeTestData(&db);

    const head = try db.getHead("main");
    const scope_dims = [_][]const u8{"culture"};
    var result = try run(&db, std.testing.allocator, &head, &scope_dims, false);
    defer result.deinit(std.testing.allocator);

    const json = try serial.serialize(std.testing.allocator, result);
    defer std.testing.allocator.free(json);

    // verify "head" field is present in the JSON
    try std.testing.expect(std.mem.indexOf(u8, json, "\"head\":\"") != null);
}

