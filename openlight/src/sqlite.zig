const c = @cImport({
    @cInclude("sqlite3.h");
});

const Sqlite = @This();

db: ?*c.sqlite3,

pub const Error = error{
    SqliteError,
    OutOfMemory,
    InvalidInput,
};

// -- Connection lifecycle --

pub fn open(path: [*:0]const u8) Error!Sqlite {
    var db: ?*c.sqlite3 = null;
    const rc = c.sqlite3_open(path, &db);

    if (rc != c.SQLITE_OK) {
        if (db) |d| _ = c.sqlite3_close(d);
        return error.SqliteError;
    }

    return .{ .db = db };
}

pub fn close(self: *Sqlite) void {
    if (self.db) |d| _ = c.sqlite3_close(d);
    self.db = null;
}

// -- Execution --

pub fn exec(self: *Sqlite, sql: [*:0]const u8) Error!void {
    var err_msg: [*c]u8 = null;
    const rc = c.sqlite3_exec(self.db, sql, null, null, &err_msg);

    if (rc != c.SQLITE_OK) {
        if (err_msg) |msg| c.sqlite3_free(msg);
        return error.SqliteError;
    }
}

pub fn prepare(self: *Sqlite, sql: [*:0]const u8) Error!Statement {
    var stmt: ?*c.sqlite3_stmt = null;
    const rc = c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null);

    if (rc != c.SQLITE_OK) return error.SqliteError;

    return .{ .stmt = stmt };
}

// -- Statement --

pub const Statement = struct {
    stmt: ?*c.sqlite3_stmt,

    // lifecycle

    pub fn finalize(self: *Statement) void {
        if (self.stmt) |s| _ = c.sqlite3_finalize(s);
        self.stmt = null;
    }

    pub fn step(self: *Statement) Error!bool {
        const rc = c.sqlite3_step(self.stmt);
        if (rc == c.SQLITE_ROW) return true;
        if (rc == c.SQLITE_DONE) return false;
        return error.SqliteError;
    }

    pub fn reset(self: *Statement) Error!void {
        const rc = c.sqlite3_reset(self.stmt);
        if (rc != c.SQLITE_OK) return error.SqliteError;
    }

    // bind parameters

    pub fn bindText(self: *Statement, col: c_int, text: [*:0]const u8) Error!void {
        const rc = c.sqlite3_bind_text(self.stmt, col, text, -1, c.SQLITE_TRANSIENT);
        if (rc != c.SQLITE_OK) return error.SqliteError;
    }

    pub fn bindSlice(self: *Statement, col: c_int, text: []const u8) Error!void {
        const rc = c.sqlite3_bind_text(self.stmt, col, text.ptr, @intCast(text.len), c.SQLITE_TRANSIENT);
        if (rc != c.SQLITE_OK) return error.SqliteError;
    }

    pub fn bindInt(self: *Statement, col: c_int, val: c_int) Error!void {
        const rc = c.sqlite3_bind_int(self.stmt, col, val);
        if (rc != c.SQLITE_OK) return error.SqliteError;
    }

    pub fn bindNull(self: *Statement, col: c_int) Error!void {
        const rc = c.sqlite3_bind_null(self.stmt, col);
        if (rc != c.SQLITE_OK) return error.SqliteError;
    }

    // read columns

    pub fn columnText(self: *Statement, col: c_int) ?[]const u8 {
        const ptr = c.sqlite3_column_text(self.stmt, col);
        if (ptr == null) return null;
        const len: usize = @intCast(c.sqlite3_column_bytes(self.stmt, col));
        return ptr[0..len];
    }

    pub fn columnInt(self: *Statement, col: c_int) c_int {
        return c.sqlite3_column_int(self.stmt, col);
    }
};

// -- Info --

pub fn version() []const u8 {
    return std.mem.span(c.sqlite3_libversion());
}

const std = @import("std");
