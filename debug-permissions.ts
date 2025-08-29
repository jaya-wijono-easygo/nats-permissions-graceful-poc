#!/usr/bin/env -S deno run --allow-net --allow-env

// NATS Permissions Debug Script
// This script tests basic publish permissions for both accounts

import { connect, ConnectionOptions, NatsConnection } from "https://deno.land/x/nats@v1.28.2/src/mod.ts";

interface TestAccount {
  name: string;
  user: string;
  pass: string;
}

const accounts: TestAccount[] = [
  { name: "Foo", user: "foo_user", pass: "foo_pass" },
  { name: "Bar", user: "bar_user", pass: "bar_pass" }
];

const subjects = [
  "rpc.hello.world",
  "broad.rpc.hello.world",
  "broad.rpc.test",
  "_INBOX.test"
];

async function testAccount(account: TestAccount) {
  console.log(`\n🔍 Testing ${account.name} Account (${account.user})`);
  console.log("=".repeat(50));

  let nc: NatsConnection;
  
  try {
    const opts: ConnectionOptions = {
      servers: ["localhost:4222"],
      user: account.user,
      pass: account.pass,
      name: `debug_${account.name}`,
      timeout: 5000
    };

    nc = await connect(opts);
    console.log(`✅ Connected successfully`);
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    return;
  }

  // Test publishing to each subject
  for (const subject of subjects) {
    try {
      const message = `Test from ${account.name} to ${subject}`;
      nc.publish(subject, message);
      await nc.flush(); // Ensure message is sent
      console.log(`✅ PUBLISH ${subject} - SUCCESS`);
    } catch (error) {
      console.log(`❌ PUBLISH ${subject} - FAILED: ${error.message}`);
    }
  }

  // Test subscribing to each subject
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
  console.log("Testing basic publish/subscribe permissions for all accounts");
  
  for (const account of accounts) {
    await testAccount(account);
  }

  console.log("\n📋 Expected Results:");
  console.log("Foo Account should succeed on all subjects");
  console.log("Bar Account should fail on rpc.hello.world but succeed on broad.rpc.*");
  console.log("\n✅ Debug test completed");
}

if (import.meta.main) {
  main();
}
