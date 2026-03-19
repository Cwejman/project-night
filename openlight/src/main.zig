const std = @import("std");
const Db = @import("db.zig");
const serial = @import("serial.zig");
const sqlite = @import("sqlite.zig");
const apply = @import("commands/apply.zig");
const scope_mod = @import("commands/scope.zig");
const dims = @import("commands/dims.zig");
const log = @import("commands/log.zig");
const show = @import("commands/show.zig");
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

    var db = Db.open(a.db_path) catch fatal("failed to open database");
    defer db.close();

    // init
    if (eql(a.command, "init")) {
        db.initSchema() catch fatal("failed to initialize schema");
        _ = db.createRootCommit() catch fatal("failed to create root commit");
        respond(serial.InitResponse{});

    // apply — declarative JSON mutation
    } else if (eql(a.command, "apply")) {
        const input = if (a.pos.len > 0) a.pos[0] else readStdin();
        var r = apply.run(&db, allocator, a.branch, input) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        respond(r);

    // dims — list dimensions
    } else if (eql(a.command, "dims")) {
        const d = dims.run(&db, allocator, a.branch) catch |e| fatalErr(e);
        defer dims.freeDimInfos(allocator, d);
        respond(.{ .dimensions = d });

    // scope [dimensions...] [--chunks]
    } else if (eql(a.command, "scope")) {
        var r = scope_mod.run(&db, allocator, a.branch, a.pos, a.chunks) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        respond(r);

    // log — commit history
    } else if (eql(a.command, "log")) {
        const entries = log.run(&db, allocator, a.branch) catch |e| fatalErr(e);
        defer log.freeLogEntries(allocator, entries);
        respond(.{ .commits = entries });

    // show <commit-id>
    } else if (eql(a.command, "show")) {
        const id = require(a.pos, 0, "ol show: commit id required");
        var r = show.run(&db, allocator, id) catch |e| fatalErr(e);
        defer r.deinit(allocator);
        respond(r);

    // branch
    } else if (eql(a.command, "branch")) {
        const sub = require(a.pos, 0, "ol branch: subcommand required (create/list/delete)");

        // branch create <name>
        if (eql(sub, "create")) {
            branch.create(&db, a.branch, require(a.pos, 1, "name required")) catch fatal("failed to create branch");
            respond(serial.InitResponse{});

        // branch list
        } else if (eql(sub, "list")) {
            const b = branch.list(&db, allocator) catch fatal("failed to list branches");
            defer branch.freeBranchInfos(allocator, b);
            respond(.{ .branches = b });

        // branch delete <name>
        } else if (eql(sub, "delete")) {
            branch.delete(&db, a.branch, require(a.pos, 1, "name required")) catch fatal("failed to delete branch");
            respond(serial.InitResponse{});

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
    chunks: bool,
};

fn parseArgs() Args {
    var iter = std.process.args();
    _ = iter.next();

    var db_override: ?[]const u8 = null;
    var branch_override: ?[]const u8 = null;
    var chunks = false;
    var list: std.ArrayListAligned([]const u8, null) = .{};

    while (iter.next()) |arg| {
        if (eql(arg, "--db")) {
            db_override = iter.next();
        } else if (eql(arg, "--branch")) {
            branch_override = iter.next();
        } else if (eql(arg, "--chunks")) {
            chunks = true;
        } else {
            list.append(allocator, arg) catch fatal("out of memory");
        }
    }

    const pos = list.items;
    return .{
        .command = if (pos.len > 0) pos[0] else "",
        .pos = if (pos.len > 1) pos[1..] else &.{},
        .db_path = resolve(db_override, "OPENLIGHT_DB", "openlight.db"),
        .branch = resolveSlice(branch_override, "OPENLIGHT_BRANCH", "main"),
        .chunks = chunks,
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
    \\  init    Create a new knowledge system
    \\  apply   Submit a declarative mutation (JSON via stdin or argument)
    \\  scope   Navigate the dimensional space
    \\  dims    List all dimensions
    \\  log     Commit history
    \\  show    Show a commit's content
    \\  branch  Branch management (create/list/delete)
    \\
    \\Global flags:
    \\  --db <path>      Database path (default: ./openlight.db or $OPENLIGHT_DB)
    \\  --branch <name>  Active branch (default: main or $OPENLIGHT_BRANCH)
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
    _ = branch;
}

test "sqlite linked" {
    try std.testing.expect(sqlite.version().len > 0);
}
