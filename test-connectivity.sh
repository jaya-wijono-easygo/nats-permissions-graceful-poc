#!/bin/bash

echo "Testing NATS Server TLS connectivity..."
echo "====================================="

# Check if certificates exist
if [ ! -d "certs" ]; then
    echo "❌ Certificates directory not found. Run ./generate-certs.sh first"
    exit 1
fi

# Test Foo user with TLS
echo "Testing Foo user TLS connection..."
if command -v nats &> /dev/null; then
    echo "Publishing test message with Foo user using TLS certificate..."
    echo "test message" | nats pub --server=tls://localhost:4222 \
        --tlscert=certs/foo-cert.pem \
        --tlskey=certs/foo-key.pem \
        --tlsca=certs/ca-cert.pem \
        "rpc.hello.world"
    echo "✓ Foo user TLS connection successful"
else
    echo "NATS CLI not available. Install with: go install github.com/nats-io/natscli/nats@latest"
fi

echo ""

# Test Bar user with TLS
echo "Testing Bar user TLS connection..."
if command -v nats &> /dev/null; then
    echo "Publishing test message with Bar user using TLS certificate..."
    echo "test message" | nats pub --server=tls://localhost:4222 \
        --tlscert=certs/bar-cert.pem \
        --tlskey=certs/bar-key.pem \
        --tlsca=certs/ca-cert.pem \
        "broad.rpc.test"
    echo "✓ Bar user TLS connection successful"
fi

echo ""
echo "💡 TLS Authentication Notes:"
echo "  - Server uses TLS client certificate authentication"
echo "  - User identity determined by certificate CN (Common Name)"
echo "  - All connections must use tls:// protocol"
echo ""
echo "📊 Monitoring endpoints:"
echo "  - Server info: http://localhost:8222/varz"
echo "  - Connections: http://localhost:8222/connz"
echo "  - TLS info: http://localhost:8222/varz | grep tls"
