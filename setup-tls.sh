#!/bin/bash

# Complete TLS Setup Script for NATS Permissions POC
# This script generates certificates and prepares the environment

set -e

echo "🚀 Setting up NATS TLS Permissions POC"
echo "======================================"

# Step 1: Generate certificates
echo "📋 Step 1: Generating TLS certificates..."
if [ ! -f "generate-certs.sh" ]; then
    echo "❌ generate-certs.sh not found!"
    exit 1
fi

chmod +x generate-certs.sh
./generate-certs.sh

echo ""

# Step 2: Verify NATS server configuration
echo "📋 Step 2: Verifying NATS server configuration..."
if [ ! -f "nats-server.conf" ]; then
    echo "❌ nats-server.conf not found!"
    exit 1
fi

echo "✅ Configuration file found"

# Step 3: Create startup script
echo "📋 Step 3: Creating server startup script..."
cat > start-server.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting NATS Server with TLS authentication..."
echo "================================================="

# Check if certificates exist
if [ ! -d "certs" ]; then
    echo "❌ Certificates not found. Run ./setup-tls.sh first"
    exit 1
fi

# Check if NATS server is available
if ! command -v nats-server &> /dev/null; then
    echo "❌ nats-server not found. Please install NATS server first."
    echo "   macOS: brew install nats-server"
    echo "   Other: https://github.com/nats-io/nats-server/releases"
    exit 1
fi

# Start the server
echo "🔐 Starting NATS server with TLS client certificate authentication..."
nats-server -c nats-server.conf

EOF

chmod +x start-server.sh

# Step 4: Make test script executable
echo "📋 Step 4: Setting up connectivity test script..."
chmod +x test-connectivity.sh

echo ""
echo "✅ TLS setup completed successfully!"
echo ""
echo "📁 Generated files:"
echo "  - certs/           (TLS certificates directory)"
echo "  - start-server.sh  (Server startup script)"  
echo "  - All scripts are now executable"
echo ""
echo "🚀 Next steps:"
echo "  1. Start the NATS server: ./start-server.sh"
echo "  2. Test connectivity: ./test-connectivity.sh"
echo "  3. Run the POC scenarios with Node.js"
echo ""
echo "💡 Example commands:"
echo "  # Terminal 1 - Start subscriber"
echo "  npx tsx subscriber.ts scenario1"
echo ""
echo "  # Terminal 2 - Run publisher"  
echo "  npx tsx publisher.ts scenario1 'Hello TLS!'"
echo ""