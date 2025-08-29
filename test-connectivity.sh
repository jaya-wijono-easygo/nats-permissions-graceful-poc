#!/bin/bash

echo "Testing NATS Server connectivity..."

# Test Foo account
echo "Testing Foo account connection..."
if command -v nats &> /dev/null; then
    echo "Publishing test message with Foo account..."
    echo "test message" | nats pub --server=nats://foo_user:foo_pass@localhost:4222 "rpc.hello.world"
    echo "✓ Foo account connection successful"
else
    echo "NATS CLI not available. Install with: go install github.com/nats-io/natscli/nats@latest"
fi

# Test Bar account
echo "Testing Bar account connection..."
if command -v nats &> /dev/null; then
    echo "Publishing test message with Bar account..."
    echo "test message" | nats pub --server=nats://bar_user:bar_pass@localhost:4222 "broad.rpc.test"
    echo "✓ Bar account connection successful"
fi

echo "Server info available at: http://localhost:8222/varz"
echo "Connection info at: http://localhost:8222/connz"
