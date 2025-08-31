# NATS Permissions POC with Leaf Node Architecture

A comprehensive Proof of Concept demonstrating NATS messaging patterns with TLS certificate-based authentication, permission systems, and innovative leaf node architecture for solving broadcasting edge cases.

## 🎯 Purpose

This POC demonstrates how NATS server uses TLS client certificates for user authentication and authorization, controlling message routing between different users, and how applications can implement intelligent fallback patterns when publishing to subjects with restricted access.

### Key Concepts Demonstrated

1. **TLS Certificate Authentication**: Users authenticated via TLS client certificates with email SANs
2. **User-Based Permissions**: Different users with varying subject access levels based on certificate identity
3. **Request/Reply Patterns**: Traditional RPC patterns with permission-based fallbacks
4. **Broadcasting Edge Case**: M publishers → N subscribers with mixed permission levels
5. **Leaf Node Architecture**: Innovative solution using leaf nodes as broadcast relays
6. **Automatic Permission-based Routing**: Smart clients that fallback to appropriate clusters
7. **Production-Ready Scalability**: No message duplication, maintains security boundaries

## 📋 Test Scenarios

### Scenario 1: Limited Publisher → Full Access Subscriber
- **Publisher**: Bar user (limited permissions)
- **Subscriber**: Foo user (full permissions)
- **Pattern**: RPC request/reply with fallback
- **Expected Behavior**: Bar tries `rpc.hello.world` (denied), falls back to `broad.rpc.hello.world` (allowed)

### Scenario 2: Full Access Publisher → Limited Subscriber  
- **Publisher**: Foo user (full permissions)
- **Subscriber**: Bar user (limited permissions)
- **Pattern**: RPC request/reply with routing
- **Expected Behavior**: Message routes to `broad.rpc.hello.world` where Bar user can subscribe

### Scenario 3: Broadcasting Edge Case (NEW)
- **Architecture**: Leaf node cluster for broadcast relay
- **Problem**: Bar user misses messages published to `rpc.>` subjects
- **Solution**: Bar automatically falls back to leaf cluster for full message coverage
- **Participants**: 
  - Foo publisher (main cluster) → publishes to any subject
  - Bar subscriber (leaf cluster fallback) → receives ALL messages via replication
  - MMM subscriber (main cluster) → receives direct messages
- **Key Benefit**: No message duplication in main cluster, automatic permission-based routing

## 🏗️ Architecture

### User Authentication & Permissions

| User | Certificate SAN | Certificate Files | Main Cluster Access | Leaf Cluster Access |
|---------|----------------|------------------|-------------------|--------------------|
| **Foo** | `foo@localhost` | `foo-cert.pem`, `foo-key.pem` | `rpc.>`, `broad.rpc.>`, `broadcast.>`, `alert.>`, `_INBOX.>` | Full access (but prefers main) |
| **Bar** | `bar@localhost` | `bar-cert.pem`, `bar-key.pem` | `broad.rpc.>`, `_INBOX.>` (restricted) | `>` (all subjects via fallback) |
| **MMM** | `mmm@localhost` | Same as Foo* | `rpc.>`, `broad.rpc.>`, `broadcast.>`, `alert.>`, `_INBOX.>` | Full access (but prefers main) |

*Note: MMM uses Foo's certificate for demo purposes

### TLS Authentication
- **Server Certificate**: `server-cert.pem`, `server-key.pem` - Server TLS certificate for both clusters
- **CA Certificate**: `ca-cert.pem` - Certificate Authority for client validation  
- **Client Certificates**: User identity based on certificate email Subject Alternative Names (SANs)
- **Protocol**: All connections use `tls://` instead of `nats://`
- **Cluster Architecture**: 
  - Main Cluster (port 4222) - Restrictive permissions
  - Leaf Cluster (port 4223) - Broadcast relay with relaxed permissions

### Subject Patterns
- `rpc.>` - RPC subjects (full access users only on main cluster)
- `broad.rpc.>` - Broadcast-accessible RPC patterns (all users)
- `broadcast.>` - General broadcast subjects
- `alert.>` - System alert subjects
- `_INBOX.>` - NATS reply subjects (required for request/reply)

### Network Flow

**Scenarios 1 & 2 (RPC Patterns):**
```
Publisher (Bar) → rpc.hello.world → ❌ Permission Denied
                ↓
                broad.rpc.hello.world → ✅ Allowed → Subscriber (Foo)
                                                    ↓
                                                   Reply
```

**Scenario 3 (Leaf Node Broadcasting):**
```
┌─────────────────┐    Leaf Link    ┌─────────────────┐
│ Main Cluster    │ ←──────────────→ │ Leaf Cluster    │
│ (Restrictive)   │    Replication   │ (Broadcast)     │
├─────────────────┤                  ├─────────────────┤
│ Foo: ✅ Full    │                  │ Bar: ✅ Full    │
│ Bar: ❌ Limited │  ──Fallback──→   │ (via replication)│
│ MMM: ✅ Full    │                  │                 │
└─────────────────┘                  └─────────────────┘
```

## 🛠️ Prerequisites

### Required Software

1. **NATS Server** v2.10+
   ```bash
   # macOS
   brew install nats-server
   
   # Linux/Windows
   # Download from: https://github.com/nats-io/nats-server/releases
   ```

2. **Node.js Runtime** v18+
   ```bash
   # macOS
   brew install node
   
   # Linux/Windows
   # Download from: https://nodejs.org
   ```

3. **NATS CLI** (Optional, for testing)
   ```bash
   go install github.com/nats-io/natscli/nats@latest
   ```

4. **OpenSSL** (for certificate generation)
   ```bash
   # Usually pre-installed on macOS/Linux
   # Windows: Download from https://www.openssl.org/
   openssl version  # Verify installation
   ```

### System Requirements
- Available ports: 4222 (NATS TLS), 8222 (monitoring)
- Network access for downloading TypeScript dependencies
- OpenSSL for certificate generation

## 🚀 Setup Instructions

### 1. Clone and Setup
```bash
# Create project directory
mkdir nats-permissions-poc
cd nats-permissions-poc

# Save all the provided files to this directory:
# - setup-tls.sh
# - generate-certs.sh
# - nats-server.conf
# - subscriber.ts  
# - publisher.ts
# - debug-permissions.ts (optional)
# - simple-permission-test.ts (optional)
```

### 2. Generate TLS Certificates and Setup
```bash
# Run the complete TLS setup (generates certs and prepares scripts)
./setup-tls.sh
```

This creates:
- `certs/` directory with all TLS certificates
- `start-server.sh` - Server startup script configured for TLS
- Executable permissions on all scripts

**Generated Certificate Files:**
- `ca-cert.pem`, `ca-key.pem` - Certificate Authority
- `server-cert.pem`, `server-key.pem` - NATS server certificates
- `foo-cert.pem`, `foo-key.pem` - Foo user client certificates
- `bar-cert.pem`, `bar-key.pem` - Bar user client certificates

### 3. Install Node.js Dependencies
```bash
# Install required packages
npm install
```

### 4. Start NATS Clusters

**For Scenarios 1 & 2 (Single Server):**
```bash
./start-server.sh
```

**For Scenario 3 (Leaf Node Architecture):**
```bash
./start-clusters.sh
```

**Expected Output:**
```
🚀 Starting NATS Leaf Node Architecture - Scenario 3
====================================================
📋 Checking prerequisites...
✅ Prerequisites check passed

🔍 Checking port availability...
✅ All ports available

🎯 Architecture Overview:
   Main Cluster (4222) ←→ Leaf Cluster (4223)
   │                        │
   ├─ Foo ✅               ├─ Foo ✅
   ├─ Bar ❌               ├─ Bar ✅ (Fallback!)
   └─ MMM ✅               └─ MMM ✅

💫 Key Benefits:
   • No message duplication in main cluster
   • Automatic permission-based routing
   • Bar subscriber can access all subjects via leaf cluster
   • Publishers remain unchanged

🔐 Starting Main Cluster (Restrictive)
   Port: 4222 (TLS)
   Monitoring: http://localhost:8222
   Leaf node: 7422
🌿 Starting Leaf Cluster (Broadcast Relay)
   Port: 4223 (TLS)
   Monitoring: http://localhost:8223
   Leaf node: 7423

✅ Both NATS clusters are running!

📊 Cluster Information:
┌─────────────────────────────────────────────────┐
│ Main Cluster (Restrictive)                      │
│   TLS Client: tls://localhost:4222              │
│   Monitoring: http://localhost:8222             │
│   Permissions: Foo✅ Bar❌ MMM✅                │
├─────────────────────────────────────────────────┤
│ Leaf Cluster (Broadcast Relay)                  │
│   TLS Client: tls://localhost:4223              │
│   Monitoring: http://localhost:8223             │
│   Permissions: Foo✅ Bar✅ MMM✅                │
└─────────────────────────────────────────────────┘

💡 Next Steps:
   1. Test the setup: npx tsx scenario3-test.ts
   2. Run subscribers: npx tsx broadcast-subscriber.ts <user>
   3. Run publisher: npx tsx broadcast-publisher.ts

📈 Monitor clusters:
   curl http://localhost:8222/varz    # Main cluster
   curl http://localhost:8223/varz    # Leaf cluster
   curl http://localhost:8222/leafz   # Leaf connections

🔄 Clusters will run until you press Ctrl+C
```

### 5. Verify Setup (Optional)
```bash
# Test TLS connectivity with certificates
./test-connectivity.sh

# Check cluster status
curl http://localhost:8222/varz    # Main cluster
curl http://localhost:8223/varz    # Leaf cluster (Scenario 3 only)
curl http://localhost:8222/leafz   # Leaf connections
```

## 🎮 Running the POC

✨ **Using Node.js with TLS Mutual Authentication**

### Scenario 1: Bar Publisher → Foo Subscriber

**Terminal 1** - Start Foo subscriber:
```bash
npx tsx subscriber.ts scenario1
```

**Terminal 2** - Run Bar publisher:
```bash
# Single message test
npx tsx publisher.ts scenario1 "Hello from Bar user"

# Interactive mode (multiple messages) 
npx tsx publisher.ts scenario1 --interactive
```

### Scenario 2: Foo Publisher → Bar Subscriber

**Terminal 1** - Start Bar subscriber:
```bash
npx tsx subscriber.ts scenario2
```

**Terminal 2** - Run Foo publisher:
```bash
# Single message test  
npx tsx publisher.ts scenario2 "Hello from Foo user"

# Interactive mode
npx tsx publisher.ts scenario2 --interactive
```

## 📊 Expected Results

### Scenario 1 Output

**Publisher (Bar user):**
```bash
🎯 Attempt 1: Trying primary subject "rpc.hello.world"
⚠️  Primary subject failed: no responders available
   🚫 Reason: Permission denied - user lacks publish access

🎯 Attempt 2: Trying fallback subject "broad.rpc.hello.world"  
✅ SUCCESS: Fallback subject responded!
   📍 Subject: broad.rpc.hello.world
   📝 Note: Message was routed via fallback
```

**Subscriber (Foo user):**
```bash
📨 Message #1
   📍 Subject: broad.rpc.hello.world
   🎯 Subscribed via: broad.rpc.>
   📄 Data: {"message":"Hello from Bar user",...}
   👤 User: Foo
```

### Scenario 2 Output

**Publisher (Foo user):**
```bash
🎯 Attempt 1: Trying primary subject "rpc.hello.world"
✅ SUCCESS: Primary subject responded!
   📍 Subject: rpc.hello.world
```

**Subscriber (Bar user):**
```bash
📨 Message #1
   📍 Subject: broad.rpc.hello.world
   🎯 Subscribed via: broad.rpc.>
   📄 Data: {"message":"Hello from Foo user",...}
   👤 User: Bar
```

### Scenario 3 Output (Leaf Node Broadcasting)

**Bar Subscriber (Automatic Fallback):**
```bash
🎯 Attempting connection to main cluster...
📝 Bar on main cluster: Limited to broad.rpc.> and _INBOX.>
📝 Bar will miss messages published to rpc.> subjects
📝 Recommending fallback to leaf cluster for full coverage
❌ Permission validation failed on main cluster
   📝 Note: Connection succeeded but subscriptions are restricted
   ⏭️  Trying next cluster...

🎯 Attempting connection to leaf cluster...
✅ Bar on leaf cluster: Can access all replicated messages
✅ Successfully validated permissions on leaf cluster
```

**Message Reception (Bar receives ALL messages):**
```bash
📨 [Bar] Broadcast Message #1
   📍 Subject: rpc.hello.world  ← Bar received this despite restrictions!
   🌿 Via leaf cluster fallback - message available despite restrictions!

📨 [Bar] Broadcast Message #2
   📍 Subject: broadcast.announcement
   🌿 Via leaf cluster fallback - message available despite restrictions!
```

**Key Benefits Demonstrated:**
- ❌ **No Message Duplication** in main cluster (only leaf sync overhead)
- ✅ **Automatic Permission-based Routing** (Bar falls back transparently)
- ✅ **Complete Message Coverage** (Bar receives ALL broadcast messages)
- ✅ **Publisher Transparency** (Publishers don't need special logic)
- ✅ **Production-Ready Scalability** (Solves M:N broadcasting edge case)

## 🔧 Interactive Mode Commands

### RPC Publishers (Scenarios 1 & 2)
When using `--interactive` flag with `publisher.ts`:

```bash
# Regular request/fallback message
Hello World!

# Simple publish (no reply expected)  
simple:broad.rpc.test:Direct message

# Exit interactive mode
exit
```

### Broadcast Publisher (Scenario 3)
When using `--interactive` flag with `broadcast-publisher.ts`:

```bash
# Publish to specific subject
<subject>:<message>

# Shortcut commands
rpc:<message>                    # Publish to rpc.hello.world
broad:<message>                  # Publish to broad.rpc.hello.world
broadcast:<message>              # Publish to broadcast.announcement
alert:<message>                  # Publish to alert.system

# Utility commands
test                            # Run broadcast pattern tests
status                          # Show connection status
exit                            # Exit interactive mode
```

### Example Interactive Session
```bash
npx tsx broadcast-publisher.ts --interactive

📢 [Foo@main] > rpc:Hello from main cluster
📡 Publishing to: rpc.hello.world
✅ Message published successfully

📢 [Foo@main] > broadcast:System maintenance at 2PM
📡 Publishing to: broadcast.announcement  
✅ Message published successfully

📢 [Foo@main] > exit
👋 Goodbye!
```

## 🐛 Debugging Tools

### TLS Permission Testing
```bash
# Test which subjects each user can access with TLS certificates
npx tsx debug-permissions.ts

# Simple TLS permission validation
npx tsx simple-permission-test.ts
```

### Certificate Verification
```bash
# Verify certificate details
openssl x509 -in certs/foo-cert.pem -text -noout | grep CN
openssl x509 -in certs/bar-cert.pem -text -noout | grep CN

# Test certificate chain
openssl verify -CAfile certs/ca-cert.pem certs/foo-cert.pem
openssl verify -CAfile certs/ca-cert.pem certs/bar-cert.pem
```

### Server Monitoring

**Single Server (Scenarios 1 & 2):**
- **Main Dashboard**: http://localhost:8222
- **Connection Info**: http://localhost:8222/connz  
- **Server Variables**: http://localhost:8222/varz

**Leaf Architecture (Scenario 3):**
- **Main Cluster**: http://localhost:8222/varz
- **Leaf Cluster**: http://localhost:8223/varz
- **Leaf Connections**: http://localhost:8222/leafz
- **Message Flow**: Watch logs for `[LMSG]` (leaf messages)

### Log Analysis
```bash
# View server logs
cd nats-poc-config
tail -f nats-server.log

# Check for permission violations
grep -i "violation\|permission" nats-server.log
```

## 🔍 Understanding the Results

### Permission Enforcement
The NATS server enforces permissions at the protocol level:
- **Publish violations**: Server logs show permission errors but client doesn't throw exceptions
- **Subscribe violations**: Subscriptions fail and are logged
- **Request timeouts**: Occur when no authorized subscribers exist

### Message Routing Behavior
1. **Direct routing**: When both users have access to the same subject
2. **Fallback routing**: When publisher lacks permission for primary subject
3. **No routing**: When neither primary nor fallback subjects are accessible

### Client Behavior Patterns
- **Publishers**: Implement retry/fallback logic for reliability
- **Subscribers**: Use wildcard patterns to catch routed messages
- **Request/Reply**: Requires active subscribers with appropriate permissions

## 📁 Project Structure

```
nats-permissions-poc/
├── nats-server-config.sh      # Server setup script
├── subscriber.ts              # Dual subscription client
├── publisher.ts               # Request/fallback publisher  
├── debug-permissions.ts       # Permission testing tool
├── simple-permission-test.ts  # Basic permission validation
├── README.md                  # This documentation
└── nats-poc-config/
    ├── nats-server.conf       # Server configuration
    ├── start-server.sh        # Server startup script
    ├── test-connectivity.sh   # Connection test
    └── nats-server.log        # Server logs
```

## 🚨 Troubleshooting

### Common TLS Issues

**"Connection refused" or TLS errors:**
```bash
# Ensure NATS server is running with TLS
./start-server.sh

# Check if certificates exist
ls -la certs/

# Regenerate certificates if needed
./generate-certs.sh
```

**"Certificate verification failed" errors:**
```bash
# Verify certificate chain
openssl verify -CAfile certs/ca-cert.pem certs/foo-cert.pem
openssl verify -CAfile certs/ca-cert.pem certs/bar-cert.pem

# Check certificate CN matches expected user
openssl x509 -in certs/foo-cert.pem -text -noout | grep "CN="
```

**"No responders" errors:**  
```bash
# Start subscriber first, then publisher
# Subscribers must be active before publisher sends requests
# Both must use correct TLS certificates
```

**Permission not working:**
```bash
# Verify server TLS configuration
curl http://localhost:8222/varz | grep -i tls

# Check server logs for TLS/auth errors
tail -20 nats-server.log
```

**Node.js/npm issues:**
```bash
# Install dependencies if missing
npm install

# Clear npm cache and reinstall
npm cache clean --force && npm install
```

### Port Conflicts
If ports 4222 or 8222 are in use:
1. Stop existing NATS servers: `pkill nats-server`
2. Check port usage: `lsof -i :4222` and `lsof -i :8222`
3. Modify ports in `nats-server.conf` if needed

## 🔐 TLS Certificate Management

### Certificate Renewal
```bash
# Certificates are valid for 365 days by default
# Check certificate expiration
openssl x509 -in certs/server-cert.pem -text -noout | grep "Not After"

# Regenerate all certificates
rm -rf certs/
./generate-certs.sh
```

### Adding New Users
```bash
# Generate new user certificate (example: alice_user)
openssl genrsa -out certs/alice-key.pem 2048
openssl req -new -key certs/alice-key.pem -out alice-csr.pem -subj "/CN=alice_user/O=NATS-CLIENT"
openssl x509 -req -in alice-csr.pem -CA certs/ca-cert.pem -CAkey certs/ca-key.pem -CAcreateserial -out certs/alice-cert.pem -days 365
rm alice-csr.pem

# Add user to nats-server.conf authorization section
```

### Security Best Practices
- Keep private keys (`*-key.pem`) secure with 600 permissions
- Protect the CA private key (`ca-key.pem`) - consider offline storage for production
- Use shorter certificate validity periods in production (30-90 days)
- Implement certificate rotation procedures
- Monitor certificate expiration dates

## 🔗 Related Documentation

- [NATS Server Configuration](https://docs.nats.io/running-a-nats-service/configuration)
- [NATS Authorization](https://docs.nats.io/running-a-nats-service/configuration/securing_nats/authorization)
- [NATS.js Client Documentation](https://github.com/nats-io/nats.js)
- [NATS Request/Reply](https://docs.nats.io/nats-concepts/core-nats/reqreply)

---

**Happy messaging! 🚀**
