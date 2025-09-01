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
# Scenario 1 & 2: RPC Request-Response Pattern
# Run subscriber (Terminal 1)
npx tsx subscriber.ts scenario1
npx tsx subscriber.ts scenario2

# Run publisher (Terminal 2)  
npx tsx publisher.ts scenario1 "Hello World"
npx tsx publisher.ts scenario1 --interactive
npx tsx publisher.ts scenario2 "Hello World"
npx tsx publisher.ts scenario2 --interactive

# Scenario 3: Broadcasting with Leaf Node Architecture
# Start both NATS clusters (Terminal 1)
./start-clusters.sh

# Run automated test (Terminal 2)
npx tsx scenario3-test.ts

# Manual testing:
# Terminal 2 - Start subscribers
npx tsx broadcast-subscriber.ts foo    # Connects to main cluster
npx tsx broadcast-subscriber.ts bar    # Falls back to leaf cluster
npx tsx broadcast-subscriber.ts mmm    # Connects to main cluster

# Terminal 3 - Test broadcasting  
npx tsx broadcast-publisher.ts --test      # Run broadcast tests
npx tsx broadcast-publisher.ts --interactive # Interactive mode
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
- **broadcast-subscriber.ts**: Smart subscriber with automatic cluster fallback for Scenario 3
- **broadcast-publisher.ts**: Publisher for testing broadcasting patterns across clusters
- **nats-main-cluster.conf**: Main restrictive cluster with leaf node configuration
- **nats-leaf-cluster.conf**: Leaf broadcast relay cluster with relaxed permissions

### User Structure (TLS Certificate-based)
- **Foo User** (cert SAN: `foo@localhost`): Full access to both `rpc.hello.world` and `broad.rpc.>` subjects
- **Bar User** (cert SAN: `bar@localhost`): Limited access to only `broad.rpc.>` subjects (no access to `rpc.hello.world`)
- **MMM User** (cert SAN: `mmm@localhost`): Full access like Foo user (for Scenario 3 testing)
- **Authentication**: Users identified by TLS client certificate email Subject Alternative Names (SANs)
- **Certificate Files**: `certs/foo-cert.pem`, `certs/bar-cert.pem`, `certs/mmm-cert.pem` with corresponding private keys
- **Cluster Access**: Main cluster enforces restrictions, leaf cluster provides fallback access

### Message Flow Pattern

**Scenarios 1 & 2 (RPC):**
1. Publishers attempt primary subject (e.g., `rpc.hello.world`)
2. If permission denied or no responders, fallback to broader subject (e.g., `broad.rpc.hello.world`)  
3. Subscribers use wildcard patterns (`broad.rpc.>`) to catch both direct and fallback messages

**Scenario 3 (Broadcasting with Leaf Node Architecture):**
1. Subscribers connect to main cluster first
2. If permission denied, automatically fallback to leaf cluster  
3. Publishers broadcast to main cluster
4. Leaf node replicates messages from main cluster
5. All subscribers receive messages regardless of original permissions

### Key Scenarios
- **Scenario 1**: Bar user publisher (limited) → Foo user subscriber (full access)
- **Scenario 2**: Foo user publisher (full) → Bar user subscriber (limited access)
- **Scenario 3**: Broadcasting edge case - M publishers → N subscribers with mixed permissions using leaf node architecture

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

**RPC Publisher (publisher.ts):**
- Regular message: `Hello World!`
- Simple publish: `simple:broad.rpc.test:Direct message`
- Exit: `exit` or `quit`

**Broadcast Publisher (broadcast-publisher.ts):**
- `<subject>:<message>` - Publish to specific subject
- `rpc:<message>` - Publish to rpc.hello.world
- `broad:<message>` - Publish to broad.rpc.hello.world
- `broadcast:<message>` - Publish to broadcast.announcement
- `test` - Run broadcast pattern tests
- `status` - Show connection status
- `exit` - Exit interactive mode