const std = @import("std");
const Db = @import("db.zig");
const serial = @import("serial.zig");
const sqlite = @import("sqlite.zig");
const apply = @import("commands/apply.zig");
const scope_mod = @import("commands/scope.zig");
const dims = @import("commands/dims.zig");
const log = @import("commands/log.zig");
const show = @import("commands/show.zig");
const diff = @import("commands/diff.zig");
const branch = @import("commands/branch.zig");

const allocator = std.heap.page_allocator;

pub fn main() !void {
    const a = parseArgs();

    // help
    if (eql(a.command, "--help") or eql(a.command, "-h") or a.command.len == 0) {
        if (a.command.len == 0) writeStderr("ol: no command given\n");
        writeStdout(help_text);
        return;
    }

    // init — creates .openlight/ directory, db, and config
    if (eql(a.command, "init")) {
        initProject(a);
        if (a.human) print("Initialized .openlight/\n", .{}) else respond(serial.InitResponse{});
        return;
    }

    var db = Db.open(a.db_path) catch fatal("failed to open database");
    defer db.close();

    // apply — declarative JSON mutation
    if (eql(a.command, "apply")) {
        const input = if (a.pos.len > 0) a.pos[0] else readStdin();
        var r = apply.run(&db, allocator, a.branch, input) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        if (a.human) humanApply(&r) else respond(r);

    // dims — list dimensions
    } else if (eql(a.command, "dims")) {
        const head = resolveHead(&db, a);
        const d = dims.run(&db, allocator, &head) catch |e| fatalErr(e);
        defer dims.freeDimInfos(allocator, d);
        if (a.human) humanDims(d) else respond(.{ .dimensions = d });

    // scope [dimensions...] [--chunks]
    } else if (eql(a.command, "scope")) {
        const head = resolveHead(&db, a);
        var r = scope_mod.run(&db, allocator, &head, a.pos, a.chunks) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        if (a.human) humanScope(&r) else respond(r);

    // log — commit history [--limit N] [--chunk id] [--dim name]
    } else if (eql(a.command, "log")) {
        const head = resolveHead(&db, a);
        const entries = log.run(&db, allocator, &head, .{
            .limit = a.limit,
            .chunk = a.chunk_filter,
            .dim = a.dim_filter,
        }) catch |e| fatalErr(e);
        defer log.freeLogEntries(allocator, entries);
        if (a.human) humanLog(entries) else respond(.{ .commits = entries });

    // show <commit-id>
    } else if (eql(a.command, "show")) {
        const id = require(a.pos, 0, "ol show: commit id required");
        var r = show.run(&db, allocator, id) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        if (a.human) humanShow(&r) else respond(r);

    // diff <commit-a> <commit-b>
    } else if (eql(a.command, "diff")) {
        const commit_a = require(a.pos, 0, "ol diff: two commit ids required");
        const commit_b = require(a.pos, 1, "ol diff: two commit ids required");
        var r = diff.run(&db, allocator, commit_a, commit_b) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        if (a.human) humanDiff(&r) else respond(r);

    // branch
    } else if (eql(a.command, "branch")) {
        const sub = require(a.pos, 0, "ol branch: subcommand required (create/switch/list/delete)");

        // branch create <name>
        if (eql(sub, "create")) {
            branch.create(&db, a.branch, require(a.pos, 1, "name required")) catch fatal("failed to create branch");
            if (a.human) print("Created\n", .{}) else respond(serial.InitResponse{});

        // branch switch <name> — writes to .openlight/config.json
        } else if (eql(sub, "switch")) {
            const name = require(a.pos, 1, "name required");
            _ = (db.getBranchHead(name) catch fatal("database error")) orelse fatal("branch not found");
            writeConfigBranch(name);
            if (a.human) print("Switched to {s}\n", .{name}) else respond(serial.InitResponse{});

        // branch list
        } else if (eql(sub, "list")) {
            const b = branch.list(&db, allocator) catch fatal("failed to list branches");
            defer branch.freeBranchInfos(allocator, b);
            if (a.human) humanBranches(b, a.branch) else respond(.{ .branches = b });

        // branch delete <name>
        } else if (eql(sub, "delete")) {
            branch.delete(&db, a.branch, require(a.pos, 1, "name required")) catch fatal("failed to delete branch");
            if (a.human) print("Deleted\n", .{}) else respond(serial.InitResponse{});

        } else {
            fatal("unknown branch subcommand");
        }

    } else {
        fatal("unknown command. Try 'ol --help'");
    }
}

// -- Arg parsing --

const Args = struct {
    command: []const u8,
    pos: []const []const u8,
    db_path: [*:0]const u8,
    branch: []const u8,
    at: ?[]const u8,
    chunks: bool,
    limit: ?usize,
    chunk_filter: ?[]const u8,
    dim_filter: ?[]const u8,
    human: bool,
};

fn parseArgs() Args {
    var iter = std.process.args();
    _ = iter.next();

    var db_override: ?[]const u8 = null;
    var branch_override: ?[]const u8 = null;
    var at_override: ?[]const u8 = null;
    var format_override: ?[]const u8 = null;
    var chunks = false;
    var limit: ?usize = null;
    var chunk_filter: ?[]const u8 = null;
    var dim_filter: ?[]const u8 = null;
    var list: std.ArrayListAligned([]const u8, null) = .{};

    while (iter.next()) |arg| {
        if (eql(arg, "--db")) {
            db_override = iter.next();
        } else if (eql(arg, "--branch")) {
            branch_override = iter.next();
        } else if (eql(arg, "--at")) {
            at_override = iter.next();
        } else if (eql(arg, "--format")) {
            format_override = iter.next();
        } else if (eql(arg, "--chunks")) {
            chunks = true;
        } else if (eql(arg, "--limit")) {
            if (iter.next()) |n| {
                limit = std.fmt.parseInt(usize, n, 10) catch null;
            }
        } else if (eql(arg, "--chunk")) {
            chunk_filter = iter.next();
        } else if (eql(arg, "--dim")) {
            dim_filter = iter.next();
        } else {
            list.append(allocator, arg) catch fatal("out of memory");
        }
    }

    // format: explicit flag > auto-detect from TTY
    const human = if (format_override) |f|
        eql(f, "human")
    else
        std.posix.isatty(std.fs.File.stdout().handle);

    const pos = list.items;
    return .{
        .command = if (pos.len > 0) pos[0] else "",
        .pos = if (pos.len > 1) pos[1..] else &.{},
        .db_path = resolve(db_override, "OPENLIGHT_DB", ".openlight/system.db"),
        .branch = resolveSlice(branch_override, "OPENLIGHT_BRANCH", readConfigBranch()),
        .at = at_override,
        .chunks = chunks,
        .limit = limit,
        .chunk_filter = chunk_filter,
        .dim_filter = dim_filter,
        .human = human,
    };
}

fn resolve(override: ?[]const u8, env_key: []const u8, default: [*:0]const u8) [*:0]const u8 {
    if (override) |p| return allocator.dupeZ(u8, p) catch default;
    if (std.process.getEnvVarOwned(allocator, env_key)) |p|
        return allocator.dupeZ(u8, p) catch default
    else |_|
        return default;
}

fn resolveSlice(override: ?[]const u8, env_key: []const u8, default: []const u8) []const u8 {
    if (override) |p| return p;
    if (std.process.getEnvVarOwned(allocator, env_key)) |p| return p else |_| return default;
}

fn resolveHead(db: *Db, a: Args) [20]u8 {
    if (a.at) |commit_id| {
        if (commit_id.len != 20) fatal("--at: commit id must be 20 characters");
        var head: [20]u8 = undefined;
        @memcpy(&head, commit_id[0..20]);
        return head;
    }
    return db.getHead(a.branch) catch fatal("branch not found");
}

fn require(pos: []const []const u8, index: usize, msg: []const u8) []const u8 {
    if (pos.len > index) return pos[index];
    fatal(msg);
}

// -- IO --

fn readStdin() []const u8 {
    return std.fs.File.stdin().readToEndAlloc(allocator, 10 * 1024 * 1024) catch fatal("failed to read stdin");
}

fn respond(value: anytype) void {
    const bytes = serial.serialize(allocator, value) catch fatal("failed to serialize");
    defer allocator.free(bytes);
    writeStdout(bytes);
    writeStdout("\n");
}

fn fatal(msg: []const u8) noreturn {
    const bytes = serial.serialize(allocator, serial.ErrorResponse{ .@"error" = msg }) catch {
        writeStderr("ol: ");
        writeStderr(msg);
        writeStderr("\n");
        std.process.exit(1);
    };
    defer allocator.free(bytes);
    writeStderr(bytes);
    writeStderr("\n");
    std.process.exit(1);
}

fn fatalErr(err: Db.Error) noreturn {
    switch (err) {
        error.InvalidInput => fatal("invalid input"),
        error.SqliteError => fatal("database error"),
        error.OutOfMemory => fatal("out of memory"),
    }
}

// -- Project init / config --

fn initProject(a: Args) void {
    // create .openlight/ directory
    std.fs.cwd().makeDir(".openlight") catch |err| switch (err) {
        error.PathAlreadyExists => fatal(".openlight/ already exists"),
        else => fatal("failed to create .openlight/"),
    };

    // create database
    var db = Db.open(a.db_path) catch fatal("failed to create database");
    defer db.close();
    db.initSchema() catch fatal("failed to initialize schema");
    _ = db.createRootCommit() catch fatal("failed to create root commit");

    // write default config
    writeConfigBranch("main");
}

fn readConfigBranch() []const u8 {
    const file = std.fs.cwd().openFile(".openlight/config.json", .{}) catch return "main";
    defer file.close();

    const content = file.readToEndAlloc(allocator, 4096) catch return "main";
    const parsed = std.json.parseFromSlice(std.json.Value, allocator, content, .{}) catch return "main";

    if (parsed.value == .object) {
        if (parsed.value.object.get("branch")) |b| {
            if (b == .string) return b.string;
        }
    }

    return "main";
}

fn writeConfigBranch(name: []const u8) void {
    var buf: [256]u8 = undefined;
    const content = std.fmt.bufPrint(&buf, "{{\"branch\":\"{s}\"}}\n", .{name}) catch return;

    const file = std.fs.cwd().createFile(".openlight/config.json", .{}) catch return;
    defer file.close();
    file.writeAll(content) catch {};
}

// -- Human formatters --

fn print(comptime fmt: []const u8, args: anytype) void {
    var buf: [4096]u8 = undefined;
    const msg = std.fmt.bufPrint(&buf, fmt, args) catch return;
    writeStdout(msg);
}

fn humanApply(r: *const apply.ApplyResult) void {
    print("commit {s}\n", .{@as([]const u8, &r.commit_id)});
    print("created {d} chunk(s)\n", .{r.created_ids.len});
}

fn humanDims(d: []const dims.DimInfo) void {
    for (d) |dim| {
        print("{s}  instance={d} relates={d} total={d}\n", .{ dim.name, dim.instance, dim.relates, dim.total });
    }
    if (d.len == 0) print("(no dimensions)\n", .{});
}

fn humanScope(r: *const scope_mod.ScopeResult) void {
    print("scope: ", .{});
    if (r.scope.len == 0) {
        print("(all)\n", .{});
    } else {
        for (r.scope, 0..) |s, i| {
            if (i > 0) print(", ", .{});
            print("{s}", .{s});
        }
        print("\n", .{});
    }
    print("chunks: {d} total, {d} in scope", .{ r.total_chunks, r.in_scope });
    if (r.in_scope_instance > 0 or r.in_scope_relates > 0)
        print(" ({d} instance, {d} relates)", .{ r.in_scope_instance, r.in_scope_relates });
    print("\n", .{});

    if (r.dimensions.len > 0) {
        print("\ndimensions:\n", .{});
        for (r.dimensions) |dim| {
            print("  {s}  shared={d} instance={d} relates={d}\n", .{ dim.name, dim.shared, dim.instance, dim.relates });
            for (dim.connections) |conn| {
                print("    -> {s}  instance={d} relates={d}\n", .{ conn.dim, conn.instance, conn.relates });
            }
            for (dim.edges) |edge| {
                print("    ~> {s}  instance={d} relates={d}\n", .{ edge.dim, edge.instance, edge.relates });
            }
        }
    }

    if (r.items) |items| {
        print("\nchunks:\n", .{});
        for (items) |item| {
            print("  [{s}] {s}\n", .{ item.id, item.text });
            if (item.instance.len > 0) {
                print("    instance:", .{});
                for (item.instance) |d| print(" {s}", .{d});
                print("\n", .{});
            }
            if (item.relates.len > 0) {
                print("    relates:", .{});
                for (item.relates) |d| print(" {s}", .{d});
                print("\n", .{});
            }
        }
    }
}

fn humanLog(entries: []const log.LogEntry) void {
    for (entries) |e| {
        print("{s}  {s}\n", .{ e.id, e.timestamp });
    }
    if (entries.len == 0) print("(no commits)\n", .{});
}

fn humanShow(r: *const show.ShowResult) void {
    print("commit {s}\n", .{r.commit});
    for (r.chunks) |ch| {
        if (ch.removed) {
            print("  - [{s}] removed\n", .{ch.id});
        } else {
            if (ch.text) |t| {
                print("  [{s}] {s}\n", .{ ch.id, t });
            } else {
                print("  [{s}]\n", .{ch.id});
            }
            if (ch.instance.len > 0) {
                print("    instance:", .{});
                for (ch.instance) |d| print(" {s}", .{d});
                print("\n", .{});
            }
            if (ch.relates.len > 0) {
                print("    relates:", .{});
                for (ch.relates) |d| print(" {s}", .{d});
                print("\n", .{});
            }
        }
    }
}

fn humanDiff(r: *const diff.DiffResult) void {
    print("{s} -> {s}\n", .{ r.from, r.to });
    for (r.chunks) |ch| {
        if (ch.removed) {
            print("  - [{s}] removed\n", .{ch.id});
        } else {
            print("  [{s}]", .{ch.id});
            if (ch.text) |t| print(" {s}", .{t});
            print("\n", .{});
        }
    }
    if (r.chunks.len == 0) print("(no changes)\n", .{});
}

fn humanBranches(branches: []const branch.BranchInfo, active: []const u8) void {
    for (branches) |b| {
        const marker: []const u8 = if (std.mem.eql(u8, b.name, active)) "* " else "  ";
        print("{s}{s}  {s}\n", .{ marker, b.name, b.head });
    }
}

// -- IO --

fn writeStdout(msg: []const u8) void {
    std.fs.File.stdout().writeAll(msg) catch {};
}

fn writeStderr(msg: []const u8) void {
    std.fs.File.stderr().writeAll(msg) catch {};
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

const help_text =
    \\ol — OpenLight knowledge system
    \\
    \\Usage: ol <command> [options]
    \\
    \\Commands:
    \\  init    Create a new knowledge base (.openlight/)
    \\  apply   Submit a declarative mutation (JSON via stdin or argument)
    \\  scope   Navigate the dimensional space
    \\  dims    List all dimensions
    \\  log     Commit history
    \\  show    Show a commit's content
    \\  diff    Compare two commits
    \\  branch  Branch management (create/switch/list/delete)
    \\
    \\Global flags:
    \\  --db <path>      Database path (default: .openlight/system.db)
    \\  --branch <name>  Active branch (default: from .openlight/config.json)
    \\  --at <commit-id>  Read at a historical commit (dims, scope, log)
    \\  --format json|human  Output format (default: human if TTY, json if piped)
    \\
;

// -- Tests --

test {
    _ = Db;
    _ = serial;
    _ = apply;
    _ = scope_mod;
    _ = dims;
    _ = log;
    _ = show;
    _ = diff;
    _ = branch;
}

test "sqlite linked" {
    try std.testing.expect(sqlite.version().len > 0);
}
