#!/usr/bin/env node

// NATS Broadcast Publisher - Scenario 3 Leaf Node Architecture
// Tests broadcasting messages to multiple subscribers with different permission levels
// Demonstrates how leaf node architecture solves the broadcasting edge case

import { connect, ConnectionOptions, NatsConnection } from "nats";
import { readFileSync } from "fs";

interface UserConfig {
  name: string;
  certFile: string;
  keyFile: string;
  caFile: string;
}

interface ClusterInfo {
  name: string;
  url: string;
  monitoring: string;
  description: string;
}

class BroadcastPublisher {
  private config: UserConfig;
  private nc: NatsConnection | null = null;
  private connectedCluster: ClusterInfo | null = null;

  // Define available clusters (same as subscriber)
  private clusters: ClusterInfo[] = [
    {
      name: "main",
      url: "tls://localhost:4222",
      monitoring: "http://localhost:8222",
      description: "Main restrictive cluster"
    },
    {
      name: "leaf",
      url: "tls://localhost:4223", 
      monitoring: "http://localhost:8223",
      description: "Leaf broadcast relay cluster"
    }
  ];

  constructor(config: UserConfig) {
    this.config = config;
  }

  async connect(clusterName?: string): Promise<boolean> {
    console.log(`🔗 Connecting ${this.config.name} publisher...`);
    
    // If cluster specified, try only that one, otherwise try main first
    const targetClusters = clusterName 
      ? this.clusters.filter(c => c.name === clusterName)
      : [this.clusters[0]]; // Default to main cluster

    for (const cluster of targetClusters) {
      console.log(`🎯 Attempting connection to ${cluster.name} cluster...`);
      console.log(`   URL: ${cluster.url}`);
      
      try {
        const opts: ConnectionOptions = {
          servers: [cluster.url],
          tls: {
            cert: readFileSync(this.config.certFile),
            key: readFileSync(this.config.keyFile),
            ca: readFileSync(this.config.caFile)
          },
          name: `${this.config.name}_broadcast_publisher`,
          timeout: 5000
        };

        this.nc = await connect(opts);
        this.connectedCluster = cluster;
        
        console.log(`✅ Connected to ${cluster.name} cluster as ${this.config.name}`);
        console.log(`   Monitoring: ${cluster.monitoring}`);
        return true;
        
      } catch (error) {
        console.log(`❌ Failed to connect to ${cluster.name}: ${error.message}`);
      }
    }

    return false;
  }

  // Test different broadcasting patterns
  async testBroadcastPatterns() {
    if (!this.nc || !this.connectedCluster) {
      console.log("❌ Not connected to any cluster");
      return;
    }

    console.log(`\n🧪 Testing Broadcast Patterns from ${this.connectedCluster.name} cluster`);
    console.log("================================================================");

    const testCases = [
      {
        name: "Restrictive RPC Subject",
        subject: "rpc.hello.world",
        description: "Only full-access subscribers should receive this",
        expectedReceivers: ["Foo", "MMM"]
      },
      {
        name: "Broad RPC Subject", 
        subject: "broad.rpc.hello.world",
        description: "All subscribers should receive this",
        expectedReceivers: ["Foo", "Bar", "MMM"]
      },
      {
        name: "General Broadcast",
        subject: "broadcast.announcement",
        description: "General broadcast to all interested subscribers",
        expectedReceivers: ["Foo", "Bar", "MMM"]
      },
      {
        name: "System Alert",
        subject: "alert.system.maintenance", 
        description: "System alert that should reach everyone",
        expectedReceivers: ["Foo", "Bar", "MMM"]
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      console.log(`\n📡 Test ${i + 1}: ${testCase.name}`);
      console.log(`   Subject: ${testCase.subject}`);
      console.log(`   Expected receivers: ${testCase.expectedReceivers.join(', ')}`);
      console.log(`   Description: ${testCase.description}`);
      
      const messageData = {
        test: testCase.name,
        subject: testCase.subject,
        timestamp: new Date().toISOString(),
        publishedBy: this.config.name,
        publishedFrom: this.connectedCluster.name,
        sequenceNumber: i + 1,
        expectedReceivers: testCase.expectedReceivers,
        broadcastId: Math.random().toString(36).substr(2, 9)
      };

      try {
        this.nc.publish(testCase.subject, JSON.stringify(messageData));
        await this.nc.flush();
        console.log(`   ✅ Published successfully`);
        
        // Wait between messages to make output readable
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`   ❌ Publish failed: ${error.message}`);
      }
    }

    console.log(`\n📊 Broadcast test completed from ${this.connectedCluster.name} cluster`);
    console.log("   Check subscriber outputs to verify message delivery patterns");
  }

  // Interactive broadcasting mode
  async interactiveMode() {
    if (!this.nc || !this.connectedCluster) {
      console.log("❌ Not connected to any cluster");
      return;
    }

    console.log(`\n💬 Interactive Broadcasting Mode - ${this.connectedCluster.name} cluster`);
    console.log("Commands:");
    console.log("  <subject>:<message>              - Publish to specific subject");
    console.log("  rpc:<message>                    - Publish to rpc.hello.world");  
    console.log("  broad:<message>                  - Publish to broad.rpc.hello.world");
    console.log("  broadcast:<message>              - Publish to broadcast.announcement");
    console.log("  alert:<message>                  - Publish to alert.system");
    console.log("  test                             - Run broadcast pattern tests");
    console.log("  status                           - Show connection status");
    console.log("  exit                             - Exit interactive mode");

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question(`\n📢 [${this.config.name}@${this.connectedCluster.name}] > `, async (input) => {
        const trimmed = input.trim();
        
        if (trimmed === 'exit' || trimmed === 'quit') {
          console.log("👋 Goodbye!");
          rl.close();
          return;
        }

        if (trimmed === 'test') {
          await this.testBroadcastPatterns();
        } else if (trimmed === 'status') {
          console.log(`\n📋 Connection Status:`);
          console.log(`   User: ${this.config.name}`);
          console.log(`   Cluster: ${this.connectedCluster.name} (${this.connectedCluster.description})`);
          console.log(`   URL: ${this.connectedCluster.url}`);
          console.log(`   Monitoring: ${this.connectedCluster.monitoring}`);
        } else if (trimmed.includes(':')) {
          const [command, message] = trimmed.split(':', 2);
          
          let subject;
          switch (command.toLowerCase()) {
            case 'rpc':
              subject = 'rpc.hello.world';
              break;
            case 'broad':
              subject = 'broad.rpc.hello.world';
              break;
            case 'broadcast':
              subject = 'broadcast.announcement';
              break;
            case 'alert':
              subject = 'alert.system';
              break;
            default:
              subject = command; // Use command as subject directly
          }

          if (message) {
            await this.publishMessage(subject, message);
          } else {
            console.log("❌ Message cannot be empty");
          }
        } else {
          console.log("❌ Unknown command. Type 'exit' to quit or use format: <subject>:<message>");
        }

        askQuestion();
      });
    };

    askQuestion();
  }

  private async publishMessage(subject: string, message: string) {
    if (!this.nc || !this.connectedCluster) {
      console.log("❌ Not connected");
      return;
    }

    const messageData = {
      message: message,
      subject: subject,
      timestamp: new Date().toISOString(),
      publishedBy: this.config.name,
      publishedFrom: this.connectedCluster.name,
      interactive: true
    };

    try {
      console.log(`📡 Publishing to: ${subject}`);
      this.nc.publish(subject, JSON.stringify(messageData));
      await this.nc.flush();
      console.log(`✅ Message published successfully`);
    } catch (error) {
      console.log(`❌ Publish failed: ${error.message}`);
    }
  }

  async close() {
    if (this.nc) {
      await this.nc.close();
      console.log(`🔌 Disconnected from ${this.connectedCluster?.name} cluster`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Default to Foo user (full permissions) for publishing
  const userName = args.find(arg => ['foo', 'bar', 'mmm'].includes(arg.toLowerCase())) || 'foo';
  const clusterName = args.find(arg => ['main', 'leaf'].includes(arg.toLowerCase()));
  const isInteractive = args.includes('--interactive') || args.includes('-i');
  const isTest = args.includes('--test') || args.includes('-t');

  // Define user configurations
  const userConfigs: { [key: string]: UserConfig } = {
    foo: {
      name: "Foo",
      certFile: "./certs/foo-cert.pem",
      keyFile: "./certs/foo-key.pem",
      caFile: "./certs/ca-cert.pem"
    },
    bar: {
      name: "Bar",
      certFile: "./certs/bar-cert.pem",
      keyFile: "./certs/bar-key.pem",
      caFile: "./certs/ca-cert.pem"
    },
    mmm: {
      name: "MMM",
      certFile: "./certs/foo-cert.pem", // Using foo certs for MMM
      keyFile: "./certs/foo-key.pem",
      caFile: "./certs/ca-cert.pem"
    }
  };

  const config = userConfigs[userName.toLowerCase()];
  if (!config) {
    console.log("🚀 NATS Broadcast Publisher - Scenario 3");
    console.log("==========================================");
    console.log("Usage: npx tsx broadcast-publisher.ts [user] [cluster] [options]");
    console.log("");
    console.log("Parameters:");
    console.log("  user     - foo, bar, or mmm (default: foo)");
    console.log("  cluster  - main or leaf (default: main)");
    console.log("");
    console.log("Options:");
    console.log("  --interactive, -i    - Interactive mode");
    console.log("  --test, -t          - Run broadcast pattern tests");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx broadcast-publisher.ts                    # Foo user on main cluster");
    console.log("  npx tsx broadcast-publisher.ts foo main --test    # Test patterns");
    console.log("  npx tsx broadcast-publisher.ts bar leaf -i        # Bar user interactive on leaf");
    console.log("  npx tsx broadcast-publisher.ts mmm --interactive  # MMM user interactive");
    return;
  }

  const publisher = new BroadcastPublisher(config);

  try {
    // Connect to specified or default cluster
    if (!await publisher.connect(clusterName)) {
      console.log("❌ Failed to connect to any cluster");
      process.exit(1);
    }

    if (isTest) {
      // Run broadcast pattern tests
      await publisher.testBroadcastPatterns();
    } else if (isInteractive) {
      // Interactive mode
      await publisher.interactiveMode();
    } else {
      // Default: run a quick demo
      console.log("\n🎭 Running Scenario 3 Broadcasting Demo");
      console.log("This demonstrates how leaf node architecture solves the broadcasting edge case");
      console.log("Expected behavior:");
      console.log("  - Messages to 'rpc.hello.world': Only Foo & MMM receive (main cluster)");
      console.log("  - Messages to 'broad.rpc.*': All subscribers receive");
      console.log("  - Bar subscriber should receive via leaf cluster fallback");
      
      await publisher.testBroadcastPatterns();
      
      console.log("\n💡 To run interactively: npx tsx broadcast-publisher.ts --interactive");
    }

    await publisher.close();
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    await publisher.close();
    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Application error:", error);
  process.exit(1);
});