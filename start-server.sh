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

