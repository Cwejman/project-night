const std = @import("std");
const Db = @import("db.zig");
const serial = @import("serial.zig");
const sqlite = @import("sqlite.zig");

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
    \\  diff    Compare two commits
    \\  branch  Branch management
    \\
    \\Global flags:
    \\  --db <path>  Database path (default: ./openlight.db or $OPENLIGHT_DB)
    \\
;

const allocator = std.heap.page_allocator;

fn writeStderr(msg: []const u8) void {
    std.fs.File.stderr().writeAll(msg) catch {};
}

fn writeStdout(msg: []const u8) void {
    std.fs.File.stdout().writeAll(msg) catch {};
}

fn respond(value: anytype) void {
    const bytes = serial.serialize(allocator, value) catch {
        fatal("failed to serialize response");
    };
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

fn openDb(db_path: [*:0]const u8) Db {
    return Db.open(db_path) catch fatal("failed to open database");
}

fn cmdInit(db_path: [*:0]const u8) void {
    var db = openDb(db_path);
    defer db.close();
    db.initSchema() catch fatal("failed to initialize schema");
    _ = db.createRootCommit() catch fatal("failed to create root commit");
    respond(serial.InitResponse{});
}

fn cmdApply(db_path: [*:0]const u8, json_arg: ?[]const u8) void {
    const input = json_arg orelse blk: {
        const stdin = std.fs.File.stdin();
        break :blk stdin.readToEndAlloc(allocator, 10 * 1024 * 1024) catch fatal("failed to read stdin");
    };

    var db = openDb(db_path);
    defer db.close();

    var result = db.apply(allocator, input) catch |err| switch (err) {
        error.InvalidInput => fatal("invalid JSON input"),
        error.SqliteError => fatal("database error"),
        error.OutOfMemory => fatal("out of memory"),
    };
    defer result.deinit(allocator);
    respond(result);
}

fn cmdScope(db_path: [*:0]const u8, scope_dims: []const []const u8, include_chunks: bool) void {
    var db = openDb(db_path);
    defer db.close();

    var result = db.scope(allocator, scope_dims, include_chunks) catch |err| switch (err) {
        error.InvalidInput => fatal("invalid scope query"),
        error.SqliteError => fatal("database error"),
        error.OutOfMemory => fatal("out of memory"),
    };
    defer result.deinit(allocator);
    respond(result);
}

fn cmdLog(db_path: [*:0]const u8) void {
    var db = openDb(db_path);
    defer db.close();

    const entries = db.log(allocator) catch fatal("failed to read log");
    defer Db.freeLogEntries(allocator, entries);
    respond(.{ .commits = entries });
}

fn cmdShow(db_path: [*:0]const u8, commit_id: []const u8) void {
    var db = openDb(db_path);
    defer db.close();

    var result = db.show(allocator, commit_id) catch fatal("failed to show commit");
    defer result.deinit(allocator);
    respond(result);
}

fn cmdBranchSwitch(db_path: [*:0]const u8, name: []const u8) void {
    var db = openDb(db_path);
    defer db.close();
    db.branchSwitch(name) catch fatal("failed to switch branch (does it exist?)");
    respond(serial.InitResponse{});
}

fn cmdBranchCreate(db_path: [*:0]const u8, name: []const u8) void {
    var db = openDb(db_path);
    defer db.close();
    db.branchCreate(allocator, name) catch fatal("failed to create branch");
    respond(serial.InitResponse{});
}

fn cmdBranchList(db_path: [*:0]const u8) void {
    var db = openDb(db_path);
    defer db.close();
    const branches = db.branchList(allocator) catch fatal("failed to list branches");
    defer Db.freeBranchInfos(allocator, branches);
    respond(.{ .branches = branches });
}

fn cmdBranchDelete(db_path: [*:0]const u8, name: []const u8) void {
    var db = openDb(db_path);
    defer db.close();
    db.branchDelete(allocator, name) catch fatal("failed to delete branch (cannot delete main or active branch)");
    respond(serial.InitResponse{});
}

fn cmdDims(db_path: [*:0]const u8) void {
    var db = openDb(db_path);
    defer db.close();

    const dims = db.listDims(allocator) catch fatal("failed to query dimensions");
    defer Db.freeDimInfos(allocator, dims);
    respond(.{ .dimensions = dims });
}

fn resolveDbPath() [*:0]const u8 {
    var scan = std.process.args();
    while (scan.next()) |arg| {
        if (std.mem.eql(u8, arg, "--db")) {
            if (scan.next()) |path| {
                return allocator.dupeZ(u8, path) catch "openlight.db";
            }
        }
    }

    if (std.process.getEnvVarOwned(allocator, "OPENLIGHT_DB")) |path| {
        return allocator.dupeZ(u8, path) catch "openlight.db";
    } else |_| {}

    return "openlight.db";
}

pub fn main() !void {
    var args = std.process.args();
    _ = args.next(); // skip executable name

    const command = args.next() orelse {
        writeStderr("ol: no command given. Try 'ol --help'\n");
        std.process.exit(1);
    };

    if (std.mem.eql(u8, command, "--help") or std.mem.eql(u8, command, "-h")) {
        writeStdout(help_text);
        return;
    }

    const db_path = resolveDbPath();

    if (std.mem.eql(u8, command, "init")) {
        cmdInit(db_path);
    } else if (std.mem.eql(u8, command, "apply")) {
        var json_arg: ?[]const u8 = null;
        while (args.next()) |arg| {
            if (std.mem.eql(u8, arg, "--db")) {
                _ = args.next();
            } else {
                json_arg = arg;
                break;
            }
        }
        cmdApply(db_path, json_arg);
    } else if (std.mem.eql(u8, command, "dims")) {
        cmdDims(db_path);
    } else if (std.mem.eql(u8, command, "scope")) {
        var scope_dims: std.ArrayListAligned([]const u8, null) = .{};
        var include_chunks = false;
        while (args.next()) |arg| {
            if (std.mem.eql(u8, arg, "--db")) {
                _ = args.next();
            } else if (std.mem.eql(u8, arg, "--chunks")) {
                include_chunks = true;
            } else {
                scope_dims.append(allocator, arg) catch fatal("out of memory");
            }
        }
        cmdScope(db_path, scope_dims.items, include_chunks);
    } else if (std.mem.eql(u8, command, "log")) {
        cmdLog(db_path);
    } else if (std.mem.eql(u8, command, "show")) {
        var show_commit: ?[]const u8 = null;
        while (args.next()) |arg| {
            if (std.mem.eql(u8, arg, "--db")) {
                _ = args.next();
            } else {
                show_commit = arg;
                break;
            }
        }
        cmdShow(db_path, show_commit orelse {
            fatal("ol show: commit id required");
        });
    } else if (std.mem.eql(u8, command, "branch")) {
        const subcmd = args.next() orelse fatal("ol branch: subcommand required (create/switch/list/delete)");
        if (std.mem.eql(u8, subcmd, "create")) {
            var bname: ?[]const u8 = null;
            while (args.next()) |arg| {
                if (std.mem.eql(u8, arg, "--db")) {
                    _ = args.next();
                } else {
                    bname = arg;
                    break;
                }
            }
            cmdBranchCreate(db_path, bname orelse {
                fatal("ol branch create: name required");
            });
        } else if (std.mem.eql(u8, subcmd, "switch")) {
            var sname: ?[]const u8 = null;
            while (args.next()) |arg| {
                if (std.mem.eql(u8, arg, "--db")) {
                    _ = args.next();
                } else {
                    sname = arg;
                    break;
                }
            }
            cmdBranchSwitch(db_path, sname orelse {
                fatal("ol branch switch: name required");
            });
        } else if (std.mem.eql(u8, subcmd, "list")) {
            cmdBranchList(db_path);
        } else if (std.mem.eql(u8, subcmd, "delete")) {
            var bname: ?[]const u8 = null;
            while (args.next()) |arg| {
                if (std.mem.eql(u8, arg, "--db")) {
                    _ = args.next();
                } else {
                    bname = arg;
                    break;
                }
            }
            cmdBranchDelete(db_path, bname orelse {
                fatal("ol branch delete: name required");
            });
        } else {
            fatal("ol branch: unknown subcommand");
        }
    } else {
        writeStderr("ol: unknown command '");
        writeStderr(command);
        writeStderr("'. Try 'ol --help'\n");
        std.process.exit(1);
    }
}

test {
    _ = Db;
    _ = serial;
}

test "sqlite linked" {
    try std.testing.expect(sqlite.version().len > 0);
}
