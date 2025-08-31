#!/usr/bin/env node

// NATS Permissions Debug Script
// This script tests basic publish permissions for both users

import { connect, ConnectionOptions, NatsConnection } from "nats";
import { readFileSync } from "fs";

interface TestUser {
  name: string;
  certFile: string;
  keyFile: string;
  caFile: string;
}

const users: TestUser[] = [
  { 
    name: "Foo", 
    certFile: "./certs/foo-cert.pem",
    keyFile: "./certs/foo-key.pem",
    caFile: "./certs/ca-cert.pem"
  },
  { 
    name: "Bar", 
    certFile: "./certs/bar-cert.pem",
    keyFile: "./certs/bar-key.pem",
    caFile: "./certs/ca-cert.pem"
  }
];

const subjects = [
  "rpc.hello.world",
  "broad.rpc.hello.world",
  "broad.rpc.test",
  "_INBOX.test"
];

async function testUser(user: TestUser) {
  console.log(`\n🔍 Testing ${user.name} User (${user.certFile})`);
  console.log("=".repeat(50));

  let nc: NatsConnection;
  
  try {
    const opts: ConnectionOptions = {
      servers: ["tls://localhost:4222"],
      tls: {
        cert: readFileSync(user.certFile),
        key: readFileSync(user.keyFile),
        ca: readFileSync(user.caFile)
      },
      name: `debug_${user.name}`,
      timeout: 5000
    };

    nc = await connect(opts);
    console.log(`✅ Connected successfully`);
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    return;
  }

  // Test publishing to each subject
  console.log("\n📨 Testing PUBLISH permissions:");
  console.log("    Note: NATS silently drops unauthorized publishes - no exceptions thrown");
  for (const subject of subjects) {
    try {
      const message = `Test from ${user.name} to ${subject}`;
      nc.publish(subject, message);
      await nc.flush(); // Ensure message is sent
      console.log(`ℹ️  PUBLISH ${subject} - Completed (may be dropped by server)`);
    } catch (error) {
      console.log(`❌ PUBLISH ${subject} - CLIENT ERROR: ${error.message}`);
    }
  }

  // Test subscribing to each subject
  console.log("\n📡 Testing SUBSCRIBE permissions:");
  for (const subject of subjects) {
    try {
      const sub = nc.subscribe(subject, { max: 1 });
      console.log(`✅ SUBSCRIBE ${subject} - SUCCESS`);
      await sub.unsubscribe();
    } catch (error) {
      console.log(`❌ SUBSCRIBE ${subject} - FAILED: ${error.message}`);
    }
  }

  try {
    await nc.close();
    console.log(`✅ Connection closed`);
  } catch (error) {
    console.log(`⚠️  Error closing connection: ${error.message}`);
  }
}

async function main() {
  console.log("🚀 NATS Permissions Debug Tool");
  console.log("===============================");
  console.log("Testing TLS certificate authentication and permissions");
  console.log("\nUsers are authenticated via TLS certificate email SANs:");
  console.log("  - Foo: foo@localhost (full access)");
  console.log("  - Bar: bar@localhost (limited access)");
  
  for (const user of users) {
    await testUser(user);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between users
  }

  console.log("\n📋 Expected Results:");
  console.log("  SUBSCRIPTIONS:");
  console.log("    - Foo User: All subjects should succeed");
  console.log("    - Bar User: rpc.hello.world should fail, broad.rpc.* should succeed");
  console.log("  PUBLISHES:");
  console.log("    - All users: No client-side errors (server drops unauthorized publishes)");
  console.log("\n📋 To verify publish permissions:");
  console.log("  tail -f nats-server.log | grep -i 'violation\|permission'");
  console.log("\n✅ Debug test completed");
}

main();
