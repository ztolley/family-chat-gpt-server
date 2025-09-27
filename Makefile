# Simple helpers for building and testing the FamilyChat server

BINARY_NAME ?= familychat
CMD_DIR ?= ./cmd/server
BIN_DIR ?= ./bin

.PHONY: build run test clean

build:
	mkdir -p $(BIN_DIR)
	go build -o $(BIN_DIR)/$(BINARY_NAME) $(CMD_DIR)

run:
	go run $(CMD_DIR)

test:
	go test ./...

clean:
	rm -rf $(BIN_DIR)/$(BINARY_NAME)
