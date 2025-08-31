# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NATS Proof of Concept demonstrating TLS certificate-based user authentication, permissions, and graceful fallback patterns in NATS messaging. The project showcases how different users authenticated via TLS client certificates with varying subject access levels handle message routing and automatic fallbacks when publishing to restricted subjects.

## Commands

### Initial Setup
```bash
# Generate TLS certificates and setup environment
./setup-tls.sh

# Start NATS server with TLS
./start-server.sh

# Test TLS connectivity (optional)
./test-connectivity.sh
```

### Running the POC
```bash
# Run subscriber (Terminal 1)
npx tsx subscriber.ts scenario1
npx tsx subscriber.ts scenario2

# Run publisher (Terminal 2)  
npx tsx publisher.ts scenario1 "Hello World"
npx tsx publisher.ts scenario1 --interactive
npx tsx publisher.ts scenario2 "Hello World"
npx tsx publisher.ts scenario2 --interactive
```

### Testing and Debugging
```bash
# Debug TLS permissions
npx tsx debug-permissions.ts

# Simple TLS permission test
npx tsx simple-permission-test.ts

# Monitor server and TLS status
curl http://localhost:8222/varz
curl http://localhost:8222/connz
curl http://localhost:8222/varz | grep -i tls

# Verify certificates
openssl verify -CAfile certs/ca-cert.pem certs/foo-cert.pem
openssl verify -CAfile certs/ca-cert.pem certs/bar-cert.pem
```

## Architecture

### Core Components
- **subscriber.ts**: Dual subscription client that listens to multiple subject patterns simultaneously
- **publisher.ts**: Request/fallback publisher that attempts preferred subjects before falling back to alternatives
- **nats-server.conf**: NATS server configuration defining TLS authentication and user-based permissions

### User Structure (TLS Certificate-based)
- **Foo User** (cert CN: `foo_user`): Full access to both `rpc.hello.world` and `broad.rpc.>` subjects
- **Bar User** (cert CN: `bar_user`): Limited access to only `broad.rpc.>` subjects (no access to `rpc.hello.world`)
- **Authentication**: Users identified by TLS client certificate Common Name (CN)
- **Certificate Files**: `certs/foo-cert.pem`, `certs/bar-cert.pem` with corresponding private keys

### Message Flow Pattern
1. Publishers attempt primary subject (e.g., `rpc.hello.world`)
2. If permission denied or no responders, fallback to broader subject (e.g., `broad.rpc.hello.world`)  
3. Subscribers use wildcard patterns (`broad.rpc.>`) to catch both direct and fallback messages

### Key Scenarios
- **Scenario 1**: Bar user publisher (limited) → Foo user subscriber (full access)
- **Scenario 2**: Foo user publisher (full) → Bar user subscriber (limited access)

## Development Notes

### Prerequisites
- NATS Server v2.10+ with TLS support (install via `brew install nats-server` or download from GitHub)
- Node.js Runtime v18+ with tsx for TypeScript execution
- OpenSSL for certificate generation (usually pre-installed on macOS/Linux)
- Optional: NATS CLI for TLS connectivity testing (`go install github.com/nats-io/natscli/nats@latest`)

### TLS Authentication & Permissions System
The NATS server uses TLS client certificate authentication where:
- User identity is determined by certificate Common Name (CN)
- TLS mutual authentication ensures only valid certificate holders can connect
- Permissions are enforced at the protocol level based on certificate CN
- Publish violations are logged but don't throw client exceptions
- Request timeouts occur when no authorized subscribers exist
- `_INBOX.>` subjects are required for request/reply patterns
- All connections must use `tls://` protocol instead of `nats://`

### Interactive Mode Commands
- Regular message: `Hello World!`
- Simple publish: `simple:broad.rpc.test:Direct message`
- Exit: `exit` or `quit`