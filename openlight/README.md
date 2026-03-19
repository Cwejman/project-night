# ol — OpenLight CLI

Single static binary. Zig + SQLite.

## Install

```
make install
```

Downloads SQLite from sqlite.org on first build, compiles a static release binary, copies to `/usr/local/bin/ol`. Requires `zig`, `curl`, `unzip`.

## Usage

```
ol init                              # create .openlight/ in current directory
ol apply '{"chunks":[...]}'          # submit a mutation (JSON via arg or stdin)
ol dims                              # list dimensions
ol scope culture                     # navigate dimensional space
ol scope culture --chunks            # include chunk content
ol log                               # commit history
ol show <commit-id>                  # what changed in a commit
ol diff <commit-a> <commit-b>        # compare two commits
ol branch create|switch|list|delete  # branch management
```

## Global flags

```
--db <path>       database path (default: .openlight/system.db)
--branch <name>   active branch (default: from .openlight/config.json)
--at <commit-id>  read at a historical commit
--format json|human   output format (auto-detects TTY)
```

## Project structure

```
src/
├── main.zig              CLI dispatch + human formatting
├── db.zig                schema, state resolution, shared machinery
├── sqlite.zig            generic SQLite wrapper
├── serial.zig            JSON serialization
└── commands/
    ├── apply.zig          ol apply
    ├── scope.zig          ol scope
    ├── dims.zig           ol dims
    ├── log.zig            ol log
    ├── show.zig           ol show
    ├── diff.zig           ol diff
    └── branch.zig         ol branch
```

## Development

```
make test         # download deps (if needed) + run tests
make build        # download deps (if needed) + build release binary
make clean        # remove deps/, zig-out/, .zig-cache/
```
