# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NATS Proof of Concept demonstrating user-based permissions and graceful fallback patterns in NATS messaging. The project showcases how different users with varying subject access levels handle message routing and automatic fallbacks when publishing to restricted subjects.

## Commands

### Running the POC
```bash
# Start NATS server
./start-server.sh

# Test server connectivity (optional)
./test-connectivity.sh

# Run subscriber (Terminal 1)
deno run --allow-net --allow-env subscriber.ts scenario1
deno run --allow-net --allow-env subscriber.ts scenario2

# Run publisher (Terminal 2)
deno run --allow-net --allow-env publisher.ts scenario1 "Hello World"
deno run --allow-net --allow-env publisher.ts scenario1 --interactive
deno run --allow-net --allow-env publisher.ts scenario2 "Hello World"
deno run --allow-net --allow-env publisher.ts scenario2 --interactive
```

### Testing and Debugging
```bash
# Debug permissions
deno run --allow-net --allow-env debug-permissions.ts

# Simple permission test
deno run --allow-net --allow-env simple-permission-test.ts

# Monitor server
curl http://localhost:8222/varz
curl http://localhost:8222/connz
curl http://localhost:8222/accountz
```

## Architecture

### Core Components
- **subscriber.ts**: Dual subscription client that listens to multiple subject patterns simultaneously
- **publisher.ts**: Request/fallback publisher that attempts preferred subjects before falling back to alternatives
- **nats-server.conf**: NATS server configuration defining user-based permissions

### User Structure
- **Foo User** (`foo_user`/`foo_pass`): Full access to both `rpc.hello.world` and `broad.rpc.>` subjects
- **Bar User** (`bar_user`/`bar_pass`): Limited access to only `broad.rpc.>` subjects (no access to `rpc.hello.world`)

### Message Flow Pattern
1. Publishers attempt primary subject (e.g., `rpc.hello.world`)
2. If permission denied or no responders, fallback to broader subject (e.g., `broad.rpc.hello.world`)  
3. Subscribers use wildcard patterns (`broad.rpc.>`) to catch both direct and fallback messages

### Key Scenarios
- **Scenario 1**: Bar user publisher (limited) → Foo user subscriber (full access)
- **Scenario 2**: Foo user publisher (full) → Bar user subscriber (limited access)

## Development Notes

### Prerequisites
- NATS Server v2.10+ (install via `brew install nats-server` or download from GitHub)
- Deno Runtime v1.28+ for TypeScript execution
- Optional: NATS CLI for connectivity testing (`go install github.com/nats-io/natscli/nats@latest`)

### Permissions System
The NATS server uses user-based authorization where:
- Permissions are enforced at the protocol level
- Publish violations are logged but don't throw client exceptions
- Request timeouts occur when no authorized subscribers exist
- `_INBOX.>` subjects are required for request/reply patterns

### Interactive Mode Commands
- Regular message: `Hello World!`
- Simple publish: `simple:broad.rpc.test:Direct message`
- Exit: `exit` or `quit`