#!/bin/bash

# Start NATS Clusters Script for Leaf Node Architecture POC
# This script starts both the main restrictive cluster and the leaf broadcast relay

set -e

echo "🚀 Starting NATS Leaf Node Architecture - Scenario 3"
echo "===================================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

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

# Check if config files exist
if [ ! -f "nats-main-cluster.conf" ]; then
    echo "❌ nats-main-cluster.conf not found!"
    exit 1
fi

if [ ! -f "nats-leaf-cluster.conf" ]; then
    echo "❌ nats-leaf-cluster.conf not found!"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use"
        echo "   Stop existing NATS servers: pkill nats-server"
        return 1
    fi
    return 0
}

# Check ports availability
echo "🔍 Checking port availability..."
check_port 4222 || exit 1  # Main cluster
check_port 4223 || exit 1  # Leaf cluster  
check_port 7422 || exit 1  # Leaf node port (main)
check_port 7423 || exit 1  # Leaf node port (leaf)
check_port 8222 || exit 1  # Main monitoring
check_port 8223 || exit 1  # Leaf monitoring

echo "✅ All ports available"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🎯 Architecture Overview:${NC}"
echo "   Main Cluster (4222) ←→ Leaf Cluster (4223)"
echo "   │                        │"
echo "   ├─ Foo ✅               ├─ Foo ✅"
echo "   ├─ Bar ❌               ├─ Bar ✅ (Fallback!)"
echo "   └─ MMM ✅               └─ MMM ✅"
echo ""
echo -e "${BLUE}💫 Key Benefits:${NC}"
echo "   • No message duplication in main cluster"
echo "   • Automatic permission-based routing"  
echo "   • Bar subscriber can access all subjects via leaf cluster"
echo "   • Publishers remain unchanged"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down NATS clusters...${NC}"
    pkill -f "nats-server.*nats-main-cluster.conf" 2>/dev/null || true
    pkill -f "nats-server.*nats-leaf-cluster.conf" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Cleanup completed${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start main cluster in background
echo -e "${BLUE}🔐 Starting Main Cluster (Restrictive)${NC}"
echo "   Port: 4222 (TLS)"
echo "   Monitoring: http://localhost:8222"
echo "   Leaf node: 7422"
nats-server -c nats-main-cluster.conf &
MAIN_PID=$!

# Wait a bit for main cluster to start
sleep 2

# Start leaf cluster in background  
echo -e "${BLUE}🌿 Starting Leaf Cluster (Broadcast Relay)${NC}"
echo "   Port: 4223 (TLS)"
echo "   Monitoring: http://localhost:8223"
echo "   Leaf node: 7423"
nats-server -c nats-leaf-cluster.conf &
LEAF_PID=$!

# Wait for both clusters to start
sleep 3

# Check if both processes are running
if ! kill -0 $MAIN_PID 2>/dev/null; then
    echo -e "${RED}❌ Main cluster failed to start${NC}"
    cleanup
fi

if ! kill -0 $LEAF_PID 2>/dev/null; then
    echo -e "${RED}❌ Leaf cluster failed to start${NC}"
    cleanup
fi

echo ""
echo -e "${GREEN}✅ Both NATS clusters are running!${NC}"
echo ""
echo -e "${BLUE}📊 Cluster Information:${NC}"
echo "┌─────────────────────────────────────────────────┐"
echo "│ Main Cluster (Restrictive)                      │"
echo "│   TLS Client: tls://localhost:4222              │"
echo "│   Monitoring: http://localhost:8222             │"
echo "│   Permissions: Foo✅ Bar❌ MMM✅                │"
echo "├─────────────────────────────────────────────────┤"
echo "│ Leaf Cluster (Broadcast Relay)                  │"
echo "│   TLS Client: tls://localhost:4223              │"
echo "│   Monitoring: http://localhost:8223             │"
echo "│   Permissions: Foo✅ Bar✅ MMM✅                │"
echo "└─────────────────────────────────────────────────┘"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "   1. Test the setup: npx tsx scenario3-test.ts"
echo "   2. Run subscribers: npx tsx broadcast-subscriber.ts <user>"
echo "   3. Run publisher: npx tsx broadcast-publisher.ts"
echo ""
echo -e "${YELLOW}📈 Monitor clusters:${NC}"
echo "   curl http://localhost:8222/varz    # Main cluster"
echo "   curl http://localhost:8223/varz    # Leaf cluster"
echo "   curl http://localhost:8222/leafz   # Leaf connections"
echo ""
echo -e "${BLUE}🔄 Clusters will run until you press Ctrl+C${NC}"

# Wait for both processes
wait