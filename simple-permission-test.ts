#!/usr/bin/env -S deno run --allow-net --allow-env

// Simple NATS Permission Test
// This script tries to publish to a forbidden subject and should fail

import { connect } from "https://deno.land/x/nats@v1.28.2/src/mod.ts";

async function testBarUserPermissions() {
  console.log("🧪 Testing Bar User Permissions");
  console.log("==================================");
  
  const nc = await connect({
    servers: ["localhost:4222"],
    user: "bar_user",
    pass: "bar_pass",
    name: "permission_test"
  });

  console.log("✅ Connected as Bar user");

  // Try to publish to a subject Bar should NOT have access to
  try {
    console.log("🚫 Attempting to publish to 'forbidden.subject'...");
    nc.publish("forbidden.subject", "This should fail");
    await nc.flush();
    console.log("❌ ERROR: Publish succeeded when it should have failed!");
  } catch (error) {
    console.log(`✅ GOOD: Publish failed as expected: ${error.message}`);
  }

  // Try to subscribe to a subject Bar should NOT have access to  
  try {
    console.log("🚫 Attempting to subscribe to 'forbidden.subject'...");
    const sub = nc.subscribe("forbidden.subject");
    console.log("❌ ERROR: Subscribe succeeded when it should have failed!");
    await sub.unsubscribe();
  } catch (error) {
    console.log(`✅ GOOD: Subscribe failed as expected: ${error.message}`);
  }

  // Try to publish to rpc.hello.world (Bar should not have access)
  try {
    console.log("🚫 Attempting to publish to 'rpc.hello.world' (should fail for Bar)...");
    nc.publish("rpc.hello.world", "Bar trying to publish");
    await nc.flush();
    console.log("❌ ERROR: Publish to rpc.hello.world succeeded when it should have failed!");
  } catch (error) {
    console.log(`✅ GOOD: Publish to rpc.hello.world failed as expected: ${error.message}`);
  }

  // Try to publish to broad.rpc.test (Bar should have access)
  try {
    console.log("✅ Attempting to publish to 'broad.rpc.test' (should succeed for Bar)...");
    nc.publish("broad.rpc.test", "Bar publishing to allowed subject");
    await nc.flush();
    console.log("✅ GOOD: Publish to broad.rpc.test succeeded as expected");
  } catch (error) {
    console.log(`❌ ERROR: Publish to broad.rpc.test failed: ${error.message}`);
  }

  await nc.close();
  console.log("✅ Test completed");
}

async function main() {
  try {
    await testBarUserPermissions();
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

if (import.meta.main) {
  main();
}
