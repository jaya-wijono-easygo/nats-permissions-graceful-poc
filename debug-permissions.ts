#!/usr/bin/env node

// NATS Permissions Debug Script
// This script tests TLS certificate authentication and subject permissions
// Supports both single server and leaf node architecture

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
  },
  {
    name: "MMM",
    certFile: "./certs/foo-cert.pem", // Uses Foo cert for demo
    keyFile: "./certs/foo-key.pem",
    caFile: "./certs/ca-cert.pem"
  }
];

const clusters = [
  {
    name: "main",
    url: "tls://localhost:4222",
    description: "Main restrictive cluster"
  },
  {
    name: "leaf", 
    url: "tls://localhost:4223",
    description: "Leaf broadcast relay cluster"
  }
];

const testSubjects = [
  {
    subject: "rpc.hello.world",
    description: "Specific RPC endpoint",
    expectedUsers: ["Foo", "MMM"]
  },
  {
    subject: "broad.rpc.hello.world", 
    description: "Broadcast RPC pattern",
    expectedUsers: ["Foo", "Bar", "MMM"]
  },
  {
    subject: "broadcast.announcement",
    description: "General broadcast subject",
    expectedUsers: ["Foo", "MMM"]
  },
  {
    subject: "alert.system",
    description: "System alert subject", 
    expectedUsers: ["Foo", "MMM"]
  },
  {
    subject: "_INBOX.test",
    description: "Reply subject",
    expectedUsers: ["Foo", "Bar", "MMM"]
  }
];

async function testUserOnCluster(user: TestUser, cluster: any) {
  console.log(`\n🔍 Testing ${user.name} on ${cluster.name} cluster`);
  console.log(`📍 ${cluster.description} (${cluster.url})`);
  console.log("=".repeat(60));

  let nc: NatsConnection;
  
  try {
    const opts: ConnectionOptions = {
      servers: [cluster.url],
      tls: {
        cert: readFileSync(user.certFile),
        key: readFileSync(user.keyFile),
        ca: readFileSync(user.caFile)
      },
      name: `debug_${user.name}_${cluster.name}`,
      timeout: 5000
    };

    nc = await connect(opts);
    console.log(`✅ Connected successfully to ${cluster.name} cluster`);
    console.log(`   User: ${user.name}`);
    console.log(`   Cluster: ${cluster.description}`);
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    return;
  }

  // Test publishing to each subject
  console.log("\n📨 Testing PUBLISH permissions:");
  console.log("    Note: NATS silently drops unauthorized publishes - no exceptions thrown");
  for (const testCase of testSubjects) {
    const expectedToWork = testCase.expectedUsers.includes(user.name);
    const expectedIcon = expectedToWork ? "✅" : "⚠️";
    
    try {
      const message = `Test from ${user.name} to ${testCase.subject} on ${cluster.name}`;
      nc.publish(testCase.subject, message);
      await nc.flush();
      console.log(`   ${expectedIcon} PUBLISH ${testCase.subject} - Completed${expectedToWork ? '' : ' (may be dropped by server)'}`);
      console.log(`      Description: ${testCase.description}`);
    } catch (error) {
      console.log(`   ❌ PUBLISH ${testCase.subject} - CLIENT ERROR: ${error.message}`);
    }
  }

  // Test subscribing to each subject
  console.log("\n📡 Testing SUBSCRIBE permissions:");
  for (const testCase of testSubjects) {
    const expectedToWork = testCase.expectedUsers.includes(user.name) || cluster.name === "leaf";
    const expectedIcon = expectedToWork ? "✅" : "❌";
    
    try {
      const sub = nc.subscribe(testCase.subject, { max: 1 });
      
      // Wait a bit to see if subscription gets terminated by server
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log(`   ${expectedIcon} SUBSCRIBE ${testCase.subject} - SUCCESS`);
      console.log(`      Description: ${testCase.description}`);
      await sub.unsubscribe();
    } catch (error) {
      console.log(`   ${expectedIcon} SUBSCRIBE ${testCase.subject} - FAILED: ${error.message}`);
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
  
  // Find target cluster
  const args = process.argv.slice(2);
  const clusterName = args[0] || "main";
  const targetCluster = clusters.find(c => c.name === clusterName);
  
  if (!targetCluster) {
    console.log(`❌ Unknown cluster: ${clusterName}`);
    console.log("Available clusters: main, leaf");
    console.log("\nUsage:");
    console.log("  npx tsx debug-permissions.ts [cluster]");
    console.log("  npx tsx debug-permissions.ts main     # Test main cluster");
    console.log("  npx tsx debug-permissions.ts leaf     # Test leaf cluster");
    return;
  }
  
  console.log(`Target cluster: ${clusterName} (${targetCluster.description})`);
  
  for (const user of users) {
    await testUserOnCluster(user, targetCluster);
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
