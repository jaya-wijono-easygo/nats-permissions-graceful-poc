#!/usr/bin/env node

// Simple NATS Permission Test
// This script tries to publish to a forbidden subject and should fail

import { connect } from "nats";
import { readFileSync } from "fs";

async function testBarUserPermissions(clusterUrl: string = "tls://localhost:4222", clusterName: string = "main") {
  console.log(`🧪 Testing Bar User Permissions on ${clusterName} cluster`);
  console.log("=" .repeat(50));
  
  let nc;
  try {
    nc = await connect({
      servers: [clusterUrl],
      tls: {
        cert: readFileSync("./certs/bar-cert.pem"),
        key: readFileSync("./certs/bar-key.pem"),
        ca: readFileSync("./certs/ca-cert.pem")
      },
      name: `permission_test_${clusterName}`,
      timeout: 5000
    });
    console.log(`✅ Connected as Bar user to ${clusterName} cluster using TLS certificate`);
    console.log(`   URL: ${clusterUrl}`);
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    return;
  }

  // Test subscription to forbidden subjects (this should fail on main, succeed on leaf)
  console.log("\n🧪 Testing subscription permissions...");
  
  const expectedRpcFail = clusterName === "main";
  const expectedIcon = expectedRpcFail ? "✅" : "⚠️";
  
  try {
    console.log(`🚫 Attempting to subscribe to 'rpc.hello.world' (should ${expectedRpcFail ? 'be denied' : 'succeed on leaf'})...`);
    const sub = nc.subscribe("rpc.hello.world", { max: 1 });
    
    // Wait a bit to see if subscription gets terminated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (expectedRpcFail) {
      console.log("⚠️  WARNING: Subscribe to rpc.hello.world did not immediately fail");
      console.log("    Note: NATS may allow subscription but deny message delivery on main cluster");
    } else {
      console.log("✅ GOOD: Subscribe to rpc.hello.world succeeded on leaf cluster");
    }
    await sub.unsubscribe();
  } catch (error) {
    console.log(`${expectedIcon} ${expectedRpcFail ? 'GOOD' : 'ERROR'}: Subscribe to rpc.hello.world ${expectedRpcFail ? 'failed' : 'failed unexpectedly'}: ${error.message}`);
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
  
  const publishMsg = `Bar user test from ${clusterName} cluster`;
  
  console.log(`🚫 Publishing to 'rpc.hello.world' (${expectedRpcFail ? 'should be silently dropped' : 'allowed on leaf'})...`);
  nc.publish("rpc.hello.world", publishMsg);
  await nc.flush();
  console.log(`    ℹ️  Publish completed (${expectedRpcFail ? 'but likely dropped by main cluster' : 'and allowed by leaf cluster'})`);
  
  console.log("✅ Publishing to 'broad.rpc.test' (should be allowed on both clusters)...");
  nc.publish("broad.rpc.test", publishMsg);
  await nc.flush();
  console.log("    ✅ Publish completed successfully");

  await nc.close();
  console.log(`\n✅ Test completed for ${clusterName} cluster`);
  console.log("\n📋 To verify publish permissions, check server logs:");
  
  if (clusterName === "main") {
    console.log("    tail -f nats-main-cluster.log | grep -i violation");
  } else {
    console.log("    tail -f nats-leaf-cluster.log | grep -i violation");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const clusterArg = args[0] || "main";
  
  const clusters = {
    main: { url: "tls://localhost:4222", name: "main" },
    leaf: { url: "tls://localhost:4223", name: "leaf" }
  };
  
  const cluster = clusters[clusterArg as keyof typeof clusters];
  if (!cluster) {
    console.log("🚀 NATS TLS Permission Test");
    console.log("============================");
    console.log("❌ Unknown cluster:", clusterArg);
    console.log("Available clusters: main, leaf");
    console.log("\nUsage:");
    console.log("  npx tsx simple-permission-test.ts [cluster]");
    console.log("  npx tsx simple-permission-test.ts main   # Test main cluster");
    console.log("  npx tsx simple-permission-test.ts leaf   # Test leaf cluster");
    return;
  }
  
  console.log("🚀 NATS TLS Permission Test");
  console.log("============================");
  console.log(`Target cluster: ${cluster.name} cluster`);
  console.log("This test validates Bar user's TLS certificate authentication");
  console.log("and permission restrictions in the NATS server.\n");
  
  try {
    await testBarUserPermissions(cluster.url, cluster.name);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

main();
