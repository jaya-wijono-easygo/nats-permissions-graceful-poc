# NATS User Permissions POC

A Proof of Concept demonstrating NATS messaging behavior with user-based permissions and automatic subject routing fallbacks.

## 🎯 Purpose

This POC demonstrates how NATS server permissions control message routing between different users and how applications can implement intelligent fallback patterns when publishing to subjects with restricted access.

### Key Concepts Demonstrated

1. **User-Based Permissions**: Different users with varying subject access levels
2. **Permission-Based Routing**: Messages automatically route to allowed subjects when primary subjects are restricted
3. **Request/Reply Patterns**: Demonstrating how NATS request/reply works across permission boundaries
4. **Dual Subscriptions**: Single subscriber listening to multiple subject patterns simultaneously
5. **Graceful Fallbacks**: Publishers that attempt preferred subjects before falling back to alternatives

## 📋 Test Scenarios

### Scenario 1: Limited Publisher → Full Access Subscriber
- **Publisher**: Bar user (limited permissions)
- **Subscriber**: Foo user (full permissions)
- **Expected Behavior**: Bar tries `rpc.hello.world` (denied), falls back to `broad.rpc.hello.world` (allowed)

### Scenario 2: Full Access Publisher → Limited Subscriber  
- **Publisher**: Foo user (full permissions)
- **Subscriber**: Bar user (limited permissions)
- **Expected Behavior**: Message routes to `broad.rpc.hello.world` where Bar user can subscribe

## 🏗️ Architecture

### User Permissions

| User | Username | Password | Allowed Subjects |
|---------|----------|----------|------------------|
| **Foo** | `foo_user` | `foo_pass` | `rpc.hello.world`, `_INBOX.>`, `broad.rpc.>` |
| **Bar** | `bar_user` | `bar_pass` | `_INBOX.>`, `broad.rpc.>` (no `rpc.hello.world`) |

### Subject Patterns
- `rpc.hello.world` - Specific RPC endpoint (Foo only)
- `broad.rpc.>` - Wildcard for broad RPC access (both users)
- `_INBOX.>` - NATS reply subjects (both users)

### Network Flow
```
Publisher (Bar) → rpc.hello.world → ❌ Permission Denied
                ↓
                broad.rpc.hello.world → ✅ Allowed → Subscriber (Foo)
                                                    ↓
                                                   Reply
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

2. **Deno Runtime** v1.28+
   ```bash
   # macOS/Linux
   curl -fsSL https://deno.land/install.sh | sh
   
   # Windows
   iwr https://deno.land/install.ps1 -useb | iex
   ```

3. **NATS CLI** (Optional, for testing)
   ```bash
   go install github.com/nats-io/natscli/nats@latest
   ```

### System Requirements
- Available ports: 4222 (NATS), 8222 (monitoring)
- Network access for downloading TypeScript dependencies

## 🚀 Setup Instructions

### 1. Clone and Setup
```bash
# Create project directory
mkdir nats-permissions-poc
cd nats-permissions-poc

# Save all the provided scripts to this directory
# - nats-server-config.sh
# - subscriber.ts  
# - publisher.ts
# - debug-permissions.ts (optional)
# - simple-permission-test.ts (optional)
```

### 2. Generate NATS Server Configuration
```bash
# Make the setup script executable and run it
chmod +x nats-server-config.sh
bash nats-server-config.sh
```

This creates:
- `nats-poc-config/` directory
- `nats-server.conf` - Server configuration with users
- `start-server.sh` - Server startup script
- `test-connectivity.sh` - Connection verification script

### 3. Start NATS Server
```bash
cd nats-poc-config
./start-server.sh
```

**Expected Output:**
```
Starting NATS Server with POC configuration...
[INF] Starting nats-server version 2.10.x
[INF] Listening for client connections on 0.0.0.0:4222
[INF] Starting http monitor on 0.0.0.0:8222
[INF] Server is ready
```

### 4. Verify Setup (Optional)
```bash
# Test basic connectivity
./test-connectivity.sh

# Or check server status
curl http://localhost:8222/varz
```

## 🎮 Running the POC

### Scenario 1: Bar Publisher → Foo Subscriber

**Terminal 1** - Start Foo subscriber:
```bash
deno run --allow-net --allow-env subscriber.ts scenario1
```

**Terminal 2** - Run Bar publisher:
```bash
# Single message test
deno run --allow-net --allow-env publisher.ts scenario1 "Hello from Bar user"

# Interactive mode (multiple messages)
deno run --allow-net --allow-env publisher.ts scenario1 --interactive
```

### Scenario 2: Foo Publisher → Bar Subscriber

**Terminal 1** - Start Bar subscriber:
```bash
deno run --allow-net --allow-env subscriber.ts scenario2
```

**Terminal 2** - Run Foo publisher:
```bash
# Single message test  
deno run --allow-net --allow-env publisher.ts scenario2 "Hello from Foo user"

# Interactive mode
deno run --allow-net --allow-env publisher.ts scenario2 --interactive
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

## 🔧 Interactive Mode Commands

When using `--interactive` flag with publisher:

```bash
# Regular request/fallback message
Hello World!

# Simple publish (no reply expected)  
simple:broad.rpc.test:Direct message

# Exit interactive mode
exit
```

## 🐛 Debugging Tools

### Permission Testing
```bash
# Test which subjects each user can access
deno run --allow-net --allow-env debug-permissions.ts

# Simple permission validation
deno run --allow-net --allow-env simple-permission-test.ts
```

### Server Monitoring
- **Monitoring Dashboard**: http://localhost:8222
- **Connection Info**: http://localhost:8222/connz  
- **Server Variables**: http://localhost:8222/varz
- **Account Info**: http://localhost:8222/accountz

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

### Common Issues

**"Connection refused" errors:**
```bash
# Ensure NATS server is running
cd nats-poc-config && ./start-server.sh
```

**"No responders" errors:**  
```bash
# Start subscriber first, then publisher
# Subscribers must be active before publisher sends requests
```

**Permission not working:**
```bash
# Verify server configuration
curl http://localhost:8222/varz | grep auth

# Check server logs for errors
tail -20 nats-poc-config/nats-server.log
```

**TypeScript import errors:**
```bash
# Clear Deno cache and retry
deno cache --reload subscriber.ts publisher.ts
```

### Port Conflicts
If ports 4222 or 8222 are in use:
1. Stop existing NATS servers: `pkill nats-server`
2. Check port usage: `lsof -i :4222` and `lsof -i :8222`
3. Modify ports in `nats-server.conf` if needed

## 🔗 Related Documentation

- [NATS Server Configuration](https://docs.nats.io/running-a-nats-service/configuration)
- [NATS Authorization](https://docs.nats.io/running-a-nats-service/configuration/securing_nats/authorization)
- [NATS.js Client Documentation](https://github.com/nats-io/nats.js)
- [NATS Request/Reply](https://docs.nats.io/nats-concepts/core-nats/reqreply)

---

**Happy messaging! 🚀**
