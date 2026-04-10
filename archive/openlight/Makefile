PREFIX ?= /usr/local
SQLITE_VERSION = 3510100
SQLITE_YEAR = 2025
SQLITE_URL = https://www.sqlite.org/$(SQLITE_YEAR)/sqlite-amalgamation-$(SQLITE_VERSION).zip

.PHONY: build test install uninstall clean

build: deps
	zig build -Doptimize=ReleaseSafe

test: deps
	zig build test

install: build
	cp zig-out/bin/ol $(PREFIX)/bin/ol

uninstall:
	rm -f $(PREFIX)/bin/ol

clean:
	rm -rf deps zig-out .zig-cache

# Download SQLite amalgamation from sqlite.org
deps: deps/sqlite3.c

deps/sqlite3.c:
	mkdir -p deps
	curl -sL $(SQLITE_URL) -o /tmp/sqlite-amalgamation.zip
	unzip -qo /tmp/sqlite-amalgamation.zip -d /tmp/sqlite-amalgamation
	cp /tmp/sqlite-amalgamation/sqlite-amalgamation-$(SQLITE_VERSION)/sqlite3.c deps/
	cp /tmp/sqlite-amalgamation/sqlite-amalgamation-$(SQLITE_VERSION)/sqlite3.h deps/
	rm -rf /tmp/sqlite-amalgamation /tmp/sqlite-amalgamation.zip
