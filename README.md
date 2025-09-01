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
| **MMM** | `mmm@localhost` | `mmm-cert.pem`, `mmm-key.pem` | `rpc.>`, `broad.rpc.>`, `broadcast.>`, `alert.>`, `_INBOX.>` | Full access (but prefers main) |

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

### Scenario 3: Broadcast Pattern with Leaf Node Architecture

**Setup** (one-time):
```bash
./start-clusters.sh  # Starts both main and leaf clusters
```

**Terminal 1** - Start subscribers with automatic cluster selection:
```bash
npx tsx broadcast-subscriber.ts foo  # Connects to main cluster
npx tsx broadcast-subscriber.ts bar  # Auto-falls back to leaf cluster  
npx tsx broadcast-subscriber.ts mmm  # Connects to main cluster
```

**Terminal 2** - Run broadcast publisher:
```bash
# Test broadcast pattern
npx tsx scenario3-test.ts

# Interactive broadcasting
npx tsx broadcast-publisher.ts --interactive
```

### Scenario 4: Request-Reply with Leaf Node Architecture

✨ **Infrastructure-level solution - no application fallback needed!**

**Terminal 1** - Start request handler:
```bash
npx tsx request-reply-leaf-subscriber.ts foo  # Handles requests on main cluster
```

**Terminal 2** - Run publishers with automatic fallback:
```bash
# Bar tries main cluster first, falls back to leaf cluster automatically
npx tsx request-reply-leaf-publisher.ts bar

# Foo tries main cluster first, succeeds immediately (optimal path)
npx tsx request-reply-leaf-publisher.ts foo

# Test with custom subject and message
npx tsx request-reply-leaf-publisher.ts bar rpc.hello.world "Fallback to leaf!"
```

**Terminal 3** - Run automated comparison test:
```bash
npx tsx scenario4-test.ts  # Compares single-cluster vs leaf architecture
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

### Scenario 4 Output (Request-Reply with Leaf Nodes)

**Bar Publisher (Automatic Fallback):**
```bash
🔗 Starting connection process for Bar...
   Strategy: Try main cluster first, test permissions, fallback to leaf if needed

🎯 Attempting connection to main cluster...
   URL: tls://localhost:4222
✅ TLS connection established to main cluster
   🧪 Testing publish capabilities for bar on main cluster...
   📝 Bar on main cluster: Testing restricted subject access
   ❌ Bar cannot access rpc.hello.world on main cluster (likely permission denied)
   ⏭️  Trying next cluster...

🎯 Attempting connection to leaf cluster...
   URL: tls://localhost:4223
✅ TLS connection established to leaf cluster
   ✅ Bar on leaf cluster: Full access available
✅ Successfully validated permissions on leaf cluster

📤 Sending request-reply message...
   Subject: rpc.hello.world
   Publisher: Bar
   Via cluster: leaf (Leaf broadcast relay cluster)
   ⏳ Waiting for response...
   
   ✅ SUCCESS: Received response!
   📍 Response from: Foo
   🌉 Cross-cluster communication confirmed! (leaf → main)
   💡 Success via leaf cluster - automatic fallback worked!
```

**Foo Subscriber (Handling Cross-Cluster Requests):**
```bash
📨 [Foo] Request #1
   📍 Subject: rpc.hello.world
   🏠 Subscriber cluster: main (Main restrictive cluster)
   👤 From: Bar
   🌿 Publisher cluster: leaf
   🌉 Cross-cluster request! leaf → main
   ✅ Reply sent
   🌉 Reply routed back: main → leaf
```

**Key Benefits Demonstrated:**
- ❌ **No Message Duplication** in main cluster (only leaf sync overhead)
- ✅ **Automatic Permission-based Routing** (Bar falls back transparently)
- ✅ **Complete Message Coverage** (Bar receives ALL broadcast messages)
- ✅ **Publisher Transparency** (Publishers don't need special logic)
- ✅ **Production-Ready Scalability** (Solves M:N broadcasting edge case)

## 📊 Scenario Comparison Table

| Scenario | Pattern | Architecture | Bar → `rpc.hello.world` | Solution Level | Benefits |
|----------|---------|--------------|-------------------------|----------------|----------|
| **1 & 2** | Request-Reply | Single Cluster | ❌ NoResponder Error | Application | • Simple setup<br>• Traditional approach |
| **3** | Pub-Sub | Leaf Node | ✅ Via leaf cluster | Infrastructure | • No silent message loss<br>• Broadcast coverage<br>• M:N scaling |
| **4** | Request-Reply | Leaf Node | ✅ Via leaf cluster | Infrastructure | • No fallback code needed<br>• Cross-cluster routing<br>• Transparent to apps |

### Key Insights:

🔴 **Traditional Single Cluster (Scenarios 1 & 2):**
- Bar user hits permission restrictions
- Requires application-level fallback logic
- Publishers must handle NoResponder errors
- Works but adds complexity to application code

🟢 **Leaf Node Architecture (Scenarios 3 & 4):**
- Infrastructure handles permission routing
- No application code changes needed
- Bar gets full access via leaf cluster
- Cleaner, more maintainable solutions
- Better production reliability

💡 **Production Recommendation:**
Use leaf node architecture (Scenarios 3 & 4) for production systems where users have different permission levels. It eliminates permission-based failures at the infrastructure level rather than requiring application workarounds.

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

### Comprehensive Testing
```bash
# Run complete test suite (all scenarios)
npx tsx test-all-scenarios.ts

# Individual scenario tests
npx tsx scenario4-test.ts          # Scenario 4: Request-reply with leaf nodes
npx tsx scenario3-test.ts          # Scenario 3: Broadcasting with leaf nodes

# Permission debugging
npx tsx debug-permissions.ts main  # Test permissions on main cluster
npx tsx debug-permissions.ts leaf  # Test permissions on leaf cluster
npx tsx simple-permission-test.ts main  # Simple validation on main cluster
npx tsx simple-permission-test.ts leaf  # Simple validation on leaf cluster
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

### Manual Testing with NATS CLI

💡 **Prerequisites**: Install NATS CLI with `go install github.com/nats-io/natscli/nats@latest`

#### Testing Main Cluster (Port 4222)

**Connect as Foo User (Full Access):**
```bash
# Test server connection
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 server check connection

# Subscribe to restricted subject
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 subscribe "rpc.hello.world"

# Publish to restricted subject
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 publish "rpc.hello.world" "Hello from Foo via CLI"

# Request-reply test (requires reply server - see below)
# Terminal 1: Start reply server first
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 reply "rpc.hello.world" "Response from Foo"

# Terminal 2: Then send request
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 request "rpc.hello.world" "Request from Foo" --timeout=5s
```

**Connect as Bar User (Restricted Access):**
```bash
# Test connection
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 server check connection

# Try to subscribe to restricted subject (should fail/be limited)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 subscribe "rpc.hello.world"

# Subscribe to allowed subject (should work)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 subscribe "broad.rpc.>"

# Publish to restricted subject (silently dropped - check server logs)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 publish "rpc.hello.world" "Hello from Bar via CLI"

# Publish to allowed subject (should work)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 publish "broad.rpc.hello.world" "Hello from Bar via CLI"
```

#### Testing Leaf Cluster (Port 4223)

**Connect as Bar User (Full Access on Leaf):**
```bash
# Test connection to leaf cluster
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 server check connection

# Subscribe to previously restricted subject (now works!)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 subscribe "rpc.hello.world"

# Publish to previously restricted subject (now works!)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 publish "rpc.hello.world" "Hello from Bar via Leaf CLI"

# Request-reply test via leaf cluster
# Terminal 1: Start reply server first (use Foo on main cluster)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 reply "rpc.hello.world" "Response from Foo to Bar"

# Terminal 2: Then send request from Bar via leaf
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 request "rpc.hello.world" "Request from Bar via Leaf" --timeout=5s
```

**Connect as MMM User (Full Access):**
```bash
# Test connection to main cluster
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/mmm-cert.pem --tlskey=./certs/mmm-key.pem \
     --server=tls://localhost:4222 server check connection

# Subscribe to any subject (has full access like Foo)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/mmm-cert.pem --tlskey=./certs/mmm-key.pem \
     --server=tls://localhost:4222 subscribe "rpc.hello.world"

# Publish to any subject
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/mmm-cert.pem --tlskey=./certs/mmm-key.pem \
     --server=tls://localhost:4222 publish "rpc.hello.world" "Hello from MMM via CLI"

# Request-reply test on main cluster
# Terminal 1: Start reply server first
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/mmm-cert.pem --tlskey=./certs/mmm-key.pem \
     --server=tls://localhost:4222 reply "rpc.hello.world" "Response from MMM"

# Terminal 2: Then send request
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/mmm-cert.pem --tlskey=./certs/mmm-key.pem \
     --server=tls://localhost:4222 request "rpc.hello.world" "Request from MMM" --timeout=5s
```

#### Cross-Cluster Communication Test

**Terminal 1** - Subscribe on Main Cluster (Foo):
```bash
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 subscribe "rpc.hello.world"
```

**Terminal 2** - Publish from Leaf Cluster (Bar):
```bash
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 publish "rpc.hello.world" "Cross-cluster message from Bar!"
```

**Result**: Foo on main cluster should receive the message from Bar via leaf cluster! 🌉

#### Request-Reply Across Clusters

**Terminal 1** - Start responder on Main Cluster (Foo):
```bash
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 reply "rpc.hello.world" "Response from Foo on main cluster"
```

**Terminal 2** - Start reply server (Foo on main cluster):
```bash
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 reply "rpc.hello.world" "Cross-cluster response from Foo"
```

**Terminal 3** - Send request from Leaf Cluster (Bar):
```bash
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 request "rpc.hello.world" "Request from Bar via leaf" --timeout=10s
```

**Expected Output**: Bar gets response from Foo across clusters! 🌟

#### Individual User Reply Server Examples

**Start Foo as Reply Server (Main Cluster):**
```bash
# Foo can handle requests on main cluster (full permissions)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 reply "rpc.hello.world" "Hello from Foo reply server"
```

**Start Bar as Reply Server (Leaf Cluster):**
```bash
# Bar must use leaf cluster to handle restricted subjects
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 reply "rpc.hello.world" "Hello from Bar reply server via leaf"
```

**Test Requests to Different Reply Servers:**
```bash
# Request to Foo on main cluster
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 request "rpc.hello.world" "Request for Foo" --timeout=5s

# Request to Bar via leaf cluster (demonstrates cross-cluster routing)
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 request "rpc.hello.world" "Request for Bar via leaf" --timeout=5s
```

**💡 Note**: When both Foo and Bar reply servers are running, NATS will load-balance requests between them, demonstrating how the leaf node architecture enables seamless service distribution across clusters.

#### Monitoring Commands

```bash
# Check cluster status
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 server info

nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4223 server info

# Monitor leaf node connections
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/foo-cert.pem --tlskey=./certs/foo-key.pem \
     --server=tls://localhost:4222 server ls

# Check server information
nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 server info
```

#### Permission Testing Shortcuts

**Test Bar's permissions evolution:**
```bash
# 1. Bar on main cluster - restricted
echo "Testing Bar on main cluster (should fail for rpc.hello.world):"
timeout 2s nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4222 subscribe "rpc.hello.world" || echo "❌ Failed as expected"

# 2. Bar on leaf cluster - full access
echo "Testing Bar on leaf cluster (should work for rpc.hello.world):"
timeout 2s nats --tlsca=./certs/ca-cert.pem --tlscert=./certs/bar-cert.pem --tlskey=./certs/bar-key.pem \
     --server=tls://localhost:4223 subscribe "rpc.hello.world" && echo "✅ Success via leaf cluster!"
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
