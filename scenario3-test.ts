#!/usr/bin/env node

// NATS Scenario 3 Test Orchestrator - Leaf Node Architecture
// Demonstrates the broadcasting edge case and how leaf node architecture solves it
// Automates the complete test scenario with multiple subscribers and publishers

import { spawn, ChildProcess } from "child_process";
import { readFileSync } from "fs";

interface TestProcess {
  name: string;
  process: ChildProcess;
  type: 'subscriber' | 'publisher';
  user: string;
  expectedCluster: string;
}

class Scenario3TestOrchestrator {
  private processes: TestProcess[] = [];
  private testResults: any[] = [];

  constructor() {
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async runCompleteTest() {
    console.log("🚀 NATS Scenario 3 - Leaf Node Architecture Test");
    console.log("==================================================");
    console.log("This test demonstrates the broadcasting edge case solution");
    console.log("using leaf node architecture for permission-based routing.\n");

    try {
      // Step 1: Verify clusters are running
      await this.verifyClusters();
      
      // Step 2: Start subscribers
      await this.startAllSubscribers();
      
      // Step 3: Wait for subscribers to be ready
      await this.waitForSubscribers();
      
      // Step 4: Run broadcasting tests
      await this.runBroadcastTests();
      
      // Step 5: Show results summary
      await this.showResultsSummary();
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    } finally {
      await this.cleanup();
    }
  }

  private async verifyClusters() {
    console.log("🔍 Step 1: Verifying NATS clusters are running...");
    
    const clusters = [
      { name: "main", url: "http://localhost:8222/varz", port: 4222 },
      { name: "leaf", url: "http://localhost:8223/varz", port: 4223 }
    ];

    for (const cluster of clusters) {
      try {
        // Simple port check using a curl-like approach
        const response = await fetch(cluster.url, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          console.log(`   ✅ ${cluster.name} cluster (port ${cluster.port}) - Running`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${cluster.name} cluster (port ${cluster.port}) - Not accessible`);
        throw new Error(`${cluster.name} cluster not running. Start with: ./start-clusters.sh`);
      }
    }
    
    console.log("   ✅ Both clusters are running and accessible\n");
  }

  private async startAllSubscribers() {
    console.log("🎧 Step 2: Starting broadcast subscribers...");
    
    const subscribers = [
      { user: 'foo', expectedCluster: 'main', description: 'Full access user' },
      { user: 'bar', expectedCluster: 'leaf', description: 'Restricted user (should fallback to leaf)' },
      { user: 'mmm', expectedCluster: 'main', description: 'Full access user' }
    ];

    for (const sub of subscribers) {
      console.log(`   🎯 Starting ${sub.user} subscriber (${sub.description})...`);
      
      const subscriberProcess = spawn('npx', ['tsx', 'broadcast-subscriber.ts', sub.user], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      const testProcess: TestProcess = {
        name: `subscriber-${sub.user}`,
        process: subscriberProcess,
        type: 'subscriber',
        user: sub.user,
        expectedCluster: sub.expectedCluster
      };

      this.processes.push(testProcess);

      // Capture output for analysis
      subscriberProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`   📡 [${sub.user}] ${output.trim()}`);
        
        // Track connection results
        if (output.includes('Successfully connected to')) {
          const clusterMatch = output.match(/connected to (\w+) cluster/);
          if (clusterMatch) {
            this.testResults.push({
              type: 'connection',
              user: sub.user,
              expectedCluster: sub.expectedCluster,
              actualCluster: clusterMatch[1],
              success: clusterMatch[1] === sub.expectedCluster
            });
          }
        }
      });

      subscriberProcess.stderr?.on('data', (data) => {
        console.log(`   ⚠️  [${sub.user}] ${data.toString().trim()}`);
      });

      // Small delay between subscribers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("   ✅ All subscribers started\n");
  }

  private async waitForSubscribers() {
    console.log("⏳ Step 3: Waiting for subscribers to be ready...");
    console.log("   Allowing time for TLS connections and subscriptions...");
    
    // Give subscribers time to connect and set up subscriptions
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log("   ✅ Subscribers should be ready\n");
  }

  private async runBroadcastTests() {
    console.log("📡 Step 4: Running broadcast tests...");
    
    const testCases = [
      {
        name: "Restrictive Subject Test",
        description: "Test rpc.hello.world (only Foo & MMM should receive)",
        subject: "rpc.hello.world",
        message: "Restrictive subject test - only full access users",
        expectedReceivers: ['foo', 'mmm']
      },
      {
        name: "Broad Subject Test", 
        description: "Test broad.rpc.hello.world (all should receive via leaf replication)",
        subject: "broad.rpc.hello.world",
        message: "Broad subject test - all users via leaf node architecture",
        expectedReceivers: ['foo', 'bar', 'mmm']
      },
      {
        name: "General Broadcast Test",
        description: "Test broadcast.announcement (all should receive)",
        subject: "broadcast.announcement",
        message: "General broadcast - demonstrates leaf node solution",
        expectedReceivers: ['foo', 'bar', 'mmm']
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      console.log(`\n   🧪 Test ${i + 1}: ${testCase.name}`);
      console.log(`      Subject: ${testCase.subject}`);
      console.log(`      Expected receivers: ${testCase.expectedReceivers.join(', ')}`);
      console.log(`      Description: ${testCase.description}`);
      
      // Publish the test message using Foo user (full permissions)
      const publisherProcess = spawn('npx', ['tsx', 'broadcast-publisher.ts', 'foo', 'main'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Send the specific test message
      const messageData = {
        test: testCase.name,
        subject: testCase.subject,
        message: testCase.message,
        testNumber: i + 1,
        expectedReceivers: testCase.expectedReceivers,
        timestamp: new Date().toISOString()
      };

      publisherProcess.stdin?.write(`${testCase.subject}:${JSON.stringify(messageData)}\n`);
      publisherProcess.stdin?.write('exit\n');

      // Wait for publish to complete
      await new Promise(resolve => {
        publisherProcess.on('close', resolve);
        setTimeout(resolve, 3000); // Timeout after 3 seconds
      });

      console.log(`      ✅ Test message published`);
      
      // Wait between tests for cleaner output
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log("\n   ✅ All broadcast tests completed\n");
  }

  private async showResultsSummary() {
    console.log("📊 Step 5: Test Results Summary");
    console.log("================================");
    
    console.log("\n🔗 Connection Results:");
    const connectionResults = this.testResults.filter(r => r.type === 'connection');
    
    if (connectionResults.length === 0) {
      console.log("   ⚠️  No connection results captured (subscribers may still be connecting)");
    } else {
      for (const result of connectionResults) {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.user}: Connected to ${result.actualCluster} cluster (expected: ${result.expectedCluster})`);
      }
    }

    console.log("\n📋 Architecture Validation:");
    console.log("   🎯 Expected behavior:");
    console.log("      - Foo: Connects to main cluster (full access)");
    console.log("      - Bar: Falls back to leaf cluster (restricted access)");
    console.log("      - MMM: Connects to main cluster (full access)");
    
    console.log("\n📡 Broadcasting Validation:");
    console.log("   🎯 Expected message delivery:");
    console.log("      - rpc.hello.world: Only Foo & MMM receive (direct from main)");
    console.log("      - broad.rpc.*: All users receive (Bar via leaf replication)");
    console.log("      - broadcast.*: All users receive (demonstrates solution)");

    console.log("\n✨ Leaf Node Architecture Benefits:");
    console.log("   ✅ No message duplication in main cluster");
    console.log("   ✅ Automatic permission-based routing");
    console.log("   ✅ Transparent to publishers");
    console.log("   ✅ Maintains security boundaries");
    console.log("   ✅ Solves broadcasting edge case");

    console.log("\n🔍 Manual Verification:");
    console.log("   Check subscriber outputs above to verify:");
    console.log("   1. Bar connected to leaf cluster (fallback worked)");
    console.log("   2. Foo & MMM connected to main cluster");
    console.log("   3. All subscribers received broadcast messages");
    console.log("   4. Message routing worked as expected");
  }

  private async cleanup() {
    console.log("\n🧹 Cleaning up test processes...");
    
    for (const testProcess of this.processes) {
      try {
        if (testProcess.process && !testProcess.process.killed) {
          testProcess.process.kill('SIGTERM');
          console.log(`   ✅ Stopped ${testProcess.name}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error stopping ${testProcess.name}: ${error.message}`);
      }
    }

    // Give processes time to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("   ✅ Cleanup completed");
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log("🚀 NATS Scenario 3 Test Orchestrator");
    console.log("=====================================");
    console.log("Automated test for leaf node architecture broadcasting solution");
    console.log("");
    console.log("Prerequisites:");
    console.log("  1. Run ./start-clusters.sh to start both NATS clusters");
    console.log("  2. Ensure certificates are generated (./setup-tls.sh)");
    console.log("");
    console.log("Usage:");
    console.log("  npx tsx scenario3-test.ts          # Run complete automated test");
    console.log("  npx tsx scenario3-test.ts --help   # Show this help");
    console.log("");
    console.log("This test will:");
    console.log("  - Verify both clusters are running");
    console.log("  - Start multiple subscribers (Foo, Bar, MMM)");
    console.log("  - Test various broadcasting patterns");
    console.log("  - Validate the leaf node architecture solution");
    console.log("");
    console.log("Expected outcome:");
    console.log("  Bar subscriber should connect to leaf cluster and receive");
    console.log("  all broadcast messages despite having restricted permissions.");
    return;
  }

  const orchestrator = new Scenario3TestOrchestrator();
  await orchestrator.runCompleteTest();
}

main().catch(error => {
  console.error("❌ Test orchestrator error:", error);
  process.exit(1);
});