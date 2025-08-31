#!/usr/bin/env node

// Simple NATS Permission Test
// This script tries to publish to a forbidden subject and should fail

import { connect } from "nats";
import { readFileSync } from "fs";

async function testBarUserPermissions() {
  console.log("🧪 Testing Bar User Permissions");
  console.log("==================================");
  
  let nc;
  try {
    nc = await connect({
      servers: ["tls://localhost:4222"],
      tls: {
        cert: readFileSync("./certs/bar-cert.pem"),
        key: readFileSync("./certs/bar-key.pem"),
        ca: readFileSync("./certs/ca-cert.pem")
      },
      name: "permission_test",
      timeout: 5000
    });
    console.log("✅ Connected as Bar user using TLS certificate");
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    return;
  }

  // Test subscription to forbidden subjects (this should fail)
  console.log("\n🧪 Testing subscription permissions...");
  
  try {
    console.log("🚫 Attempting to subscribe to 'rpc.hello.world' (should be denied)...");
    const sub = nc.subscribe("rpc.hello.world", { max: 1 });
    
    // Wait a bit to see if subscription gets terminated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("⚠️  WARNING: Subscribe to rpc.hello.world did not immediately fail");
    console.log("    Note: NATS may allow subscription but deny message delivery");
    await sub.unsubscribe();
  } catch (error) {
    console.log(`✅ GOOD: Subscribe to rpc.hello.world failed: ${error.message}`);
  }

  // Test subscription to allowed subjects (this should succeed)
  try {
    console.log("✅ Attempting to subscribe to 'broad.rpc.test' (should succeed)...");
    const sub = nc.subscribe("broad.rpc.test", { max: 1 });
    console.log("✅ GOOD: Subscribe to broad.rpc.test succeeded");
    await sub.unsubscribe();
  } catch (error) {
    console.log(`❌ ERROR: Subscribe to broad.rpc.test failed: ${error.message}`);
  }

  // Test publishing (Note: NATS typically doesn't throw errors for denied publishes)
  console.log("\n🧪 Testing publish permissions...");
  console.log("    Note: NATS silently drops unauthorized publishes - no exceptions thrown");
  
  console.log("🚫 Publishing to 'rpc.hello.world' (should be silently dropped)...");
  nc.publish("rpc.hello.world", "Bar trying to publish - should be dropped");
  await nc.flush();
  console.log("    ℹ️  Publish completed (but likely dropped by server)");
  
  console.log("✅ Publishing to 'broad.rpc.test' (should be allowed)...");
  nc.publish("broad.rpc.test", "Bar publishing to allowed subject");
  await nc.flush();
  console.log("    ✅ Publish completed successfully");

  await nc.close();
  console.log("\n✅ Test completed");
  console.log("\n📋 To verify publish permissions, check server logs:");
  console.log("    tail -f nats-server.log | grep -i violation");
}

async function main() {
  console.log("🚀 NATS TLS Permission Test");
  console.log("============================");
  console.log("This test validates Bar user's TLS certificate authentication");
  console.log("and permission restrictions in the NATS server.\n");
  
  try {
    await testBarUserPermissions();
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

main();
