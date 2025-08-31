# NATS User Permissions POC with TLS Authentication

A Proof of Concept demonstrating NATS messaging behavior with TLS certificate-based user authentication, permissions, and automatic subject routing fallbacks.

## 🎯 Purpose

This POC demonstrates how NATS server uses TLS client certificates for user authentication and authorization, controlling message routing between different users, and how applications can implement intelligent fallback patterns when publishing to subjects with restricted access.

### Key Concepts Demonstrated

1. **TLS Certificate Authentication**: Users authenticated via TLS client certificates instead of passwords
2. **User-Based Permissions**: Different users with varying subject access levels based on certificate CN
3. **Permission-Based Routing**: Messages automatically route to allowed subjects when primary subjects are restricted
4. **Request/Reply Patterns**: Demonstrating how NATS request/reply works across permission boundaries with TLS
5. **Dual Subscriptions**: Single subscriber listening to multiple subject patterns simultaneously
6. **Graceful Fallbacks**: Publishers that attempt preferred subjects before falling back to alternatives

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

### User Authentication & Permissions

| User | Certificate CN | Certificate Files | Allowed Subjects |
|---------|----------------|------------------|------------------|
| **Foo** | `foo_user` | `foo-cert.pem`, `foo-key.pem` | `rpc.hello.world`, `_INBOX.>`, `broad.rpc.>` |
| **Bar** | `bar_user` | `bar-cert.pem`, `bar-key.pem` | `_INBOX.>`, `broad.rpc.>` (no `rpc.hello.world`) |

### TLS Authentication
- **Server Certificate**: `server-cert.pem`, `server-key.pem` - Server TLS certificate
- **CA Certificate**: `ca-cert.pem` - Certificate Authority for client validation  
- **Client Certificates**: User identity based on certificate CN (Common Name)
- **Protocol**: All connections use `tls://` instead of `nats://`

### Subject Patterns
- `rpc.hello.world` - Specific RPC endpoint (Foo user only)
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

### 3. Start NATS Server with TLS
```bash
./start-server.sh
```

**Expected Output:**
```
🚀 Starting NATS Server with TLS authentication...
=================================================
🔐 Starting NATS server with TLS client certificate authentication...
[INF] Starting nats-server version 2.10.x
[INF] Listening for TLS client connections on 0.0.0.0:4222
[INF] Starting http monitor on 0.0.0.0:8222
[INF] Server is ready
```

### 4. Verify TLS Setup (Optional)
```bash
# Test TLS connectivity with certificates
./test-connectivity.sh

# Check server status and TLS configuration
curl http://localhost:8222/varz
curl http://localhost:8222/connz
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
