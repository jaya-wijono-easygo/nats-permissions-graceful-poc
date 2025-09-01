#!/bin/bash

# Certificate Generation Script for NATS TLS Authentication
# This script creates a Certificate Authority (CA) and client certificates for TLS-based authentication

set -e

CERTS_DIR="certs"
DAYS=365

echo "🔐 Generating certificates for NATS TLS authentication..."
echo "=============================================="

# Create certificates directory
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

# Generate CA private key
echo "📋 Step 1: Generating Certificate Authority (CA) private key..."
openssl genrsa -out ca-key.pem 2048

# Generate CA certificate
echo "📋 Step 2: Generating CA certificate..."
openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days $DAYS -subj "/CN=NATS-CA/O=NATS-POC"

# Generate server private key
echo "📋 Step 3: Generating server private key..."
openssl genrsa -out server-key.pem 2048

# Create server certificate extension file with SANs
echo "📋 Step 4: Creating server certificate extension file..."
cat > server-ext.conf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate server certificate signing request
echo "📋 Step 5: Generating server certificate signing request..."
openssl req -new -key server-key.pem -out server-csr.pem -subj "/CN=nats-server/O=NATS-SERVER"

# Generate server certificate signed by CA with extensions
echo "📋 Step 6: Generating server certificate..."
openssl x509 -req -in server-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out server-cert.pem -days $DAYS -extfile server-ext.conf

# Create Foo user certificate extension file with SANs
echo "📋 Step 7: Creating Foo user certificate extension file..."
cat > foo-ext.conf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
email.1 = foo@localhost
DNS.1 = foo_user
EOF

# Generate Foo user private key
echo "📋 Step 8: Generating Foo user private key..."
openssl genrsa -out foo-key.pem 2048

# Generate Foo user certificate signing request
echo "📋 Step 9: Generating Foo user certificate signing request..."
openssl req -new -key foo-key.pem -out foo-csr.pem -subj "/CN=foo_user/O=NATS-CLIENT"

# Generate Foo user certificate signed by CA with extensions
echo "📋 Step 10: Generating Foo user certificate..."
openssl x509 -req -in foo-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out foo-cert.pem -days $DAYS -extfile foo-ext.conf

# Create Bar user certificate extension file with SANs
echo "📋 Step 11: Creating Bar user certificate extension file..."
cat > bar-ext.conf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
email.1 = bar@localhost
DNS.1 = bar_user
EOF

# Generate Bar user private key
echo "📋 Step 12: Generating Bar user private key..."
openssl genrsa -out bar-key.pem 2048

# Generate Bar user certificate signing request
echo "📋 Step 13: Generating Bar user certificate signing request..."
openssl req -new -key bar-key.pem -out bar-csr.pem -subj "/CN=bar_user/O=NATS-CLIENT"

# Generate Bar user certificate signed by CA with extensions
echo "📋 Step 14: Generating Bar user certificate..."
openssl x509 -req -in bar-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out bar-cert.pem -days $DAYS -extfile bar-ext.conf

# Create MMM user certificate extension file with SANs
echo "📋 Step 15: Creating MMM user certificate extension file..."
cat > mmm-ext.conf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
email.1 = mmm@localhost
DNS.1 = mmm_user
EOF

# Generate MMM user private key
echo "📋 Step 16: Generating MMM user private key..."
openssl genrsa -out mmm-key.pem 2048

# Generate MMM user certificate signing request
echo "📋 Step 17: Generating MMM user certificate signing request..."
openssl req -new -key mmm-key.pem -out mmm-csr.pem -subj "/CN=mmm_user/O=NATS-CLIENT"

# Generate MMM user certificate signed by CA with extensions
echo "📋 Step 18: Generating MMM user certificate..."
openssl x509 -req -in mmm-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out mmm-cert.pem -days $DAYS -extfile mmm-ext.conf

# Clean up temporary files
echo "📋 Step 19: Cleaning up temporary files..."
rm -f *.csr *.conf ca-cert.srl

# Set appropriate permissions
chmod 600 *-key.pem
chmod 644 *-cert.pem

echo ""
echo "✅ Certificate generation completed!"
echo "📁 Certificates created in: $(pwd)"
echo ""
echo "📄 Generated files:"
echo "  - ca-cert.pem      (Certificate Authority certificate)"
echo "  - ca-key.pem       (Certificate Authority private key)"
echo "  - server-cert.pem  (NATS server certificate)"
echo "  - server-key.pem   (NATS server private key)"
echo "  - foo-cert.pem     (Foo user certificate)"
echo "  - foo-key.pem      (Foo user private key)"
echo "  - bar-cert.pem     (Bar user certificate)"
echo "  - bar-key.pem      (Bar user private key)"
echo "  - mmm-cert.pem     (MMM user certificate)"
echo "  - mmm-key.pem      (MMM user private key)"
echo ""
echo "🔒 Certificate validity: $DAYS days"
echo ""
echo "💡 Next steps:"
echo "  1. Update nats-server.conf to use TLS authentication"
echo "  2. Update client code to use certificate-based authentication"
echo "  3. Start the NATS server with TLS enabled"
echo ""