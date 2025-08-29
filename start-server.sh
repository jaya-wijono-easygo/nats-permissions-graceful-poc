#!/bin/bash

echo "Starting NATS Server with POC configuration..."

# Check if nats-server is available
if ! command -v nats-server &> /dev/null; then
    echo "Error: nats-server not found. Please install NATS Server."
    echo "Download from: https://github.com/nats-io/nats-server/releases"
    echo "Or install via package manager:"
    echo "  - macOS: brew install nats-server"
    echo "  - Linux: Download binary from GitHub releases"
    exit 1
fi

# Start the NATS server
echo "Starting NATS server on port 4222..."
echo "Monitoring available at http://localhost:8222"
echo "Press Ctrl+C to stop the server"

nats-server -c nats-server.conf
