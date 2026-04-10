BINARY = olb
INSTALL_PATH = /usr/local/bin/$(BINARY)

.PHONY: build test install clean

build:
	go build -buildvcs=false -o $(BINARY) .

test:
	go test ./...

install: build
	cp $(BINARY) $(INSTALL_PATH)

clean:
	rm -f $(BINARY)
