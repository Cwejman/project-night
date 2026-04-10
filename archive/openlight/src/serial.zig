const std = @import("std");

/// Serialize any value to JSON bytes. Caller owns returned memory.
pub fn serialize(allocator: std.mem.Allocator, value: anytype) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, value, .{});
}

pub const ErrorResponse = struct {
    @"error": []const u8,
};

pub const InitResponse = struct {
    ok: bool = true,
};

/// Wraps a pre-serialized JSON string so it's emitted as raw JSON, not a quoted string.
pub const RawJson = struct {
    raw: []const u8,

    pub fn jsonStringify(self: *const RawJson, jw: anytype) !void {
        try jw.print("{s}", .{self.raw});
    }
};

// -- Tests --

test "serialize init response" {
    const resp = InitResponse{};
    const json = try serialize(std.testing.allocator, resp);
    defer std.testing.allocator.free(json);
    try std.testing.expectEqualStrings("{\"ok\":true}", json);
}

test "serialize error response" {
    const resp = ErrorResponse{ .@"error" = "something went wrong" };
    const json = try serialize(std.testing.allocator, resp);
    defer std.testing.allocator.free(json);
    try std.testing.expectEqualStrings("{\"error\":\"something went wrong\"}", json);
}
