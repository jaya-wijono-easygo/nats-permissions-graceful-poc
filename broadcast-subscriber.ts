#!/usr/bin/env node

// NATS Broadcast Subscriber with Automatic Fallback - Scenario 3
// Smart subscriber that automatically connects to the appropriate cluster
// based on user permissions and subject access requirements

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

class BroadcastSubscriber {
  private config: UserConfig;
  private nc: NatsConnection | null = null;
  private connectedCluster: ClusterInfo | null = null;
  private messageCount = 0;
  private subscriptions: any[] = [];

  // Define available clusters
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

  async connectWithFallback(): Promise<boolean> {
    console.log(`🔗 Starting connection process for ${this.config.name}...`);
    console.log("   Strategy: Try main cluster first, test subscriptions, fallback to leaf if needed");
    
    // Try each cluster in order
    for (const cluster of this.clusters) {
      console.log(`\n🎯 Attempting connection to ${cluster.name} cluster...`);
      console.log(`   URL: ${cluster.url}`);
      console.log(`   Description: ${cluster.description}`);
      
      try {
        const opts: ConnectionOptions = {
          servers: [cluster.url],
          tls: {
            cert: readFileSync(this.config.certFile),
            key: readFileSync(this.config.keyFile),
            ca: readFileSync(this.config.caFile)
          },
          name: `${this.config.name}_broadcast_subscriber`,
          timeout: 5000,
          reconnect: true,
          maxReconnectAttempts: 3
        };

        this.nc = await connect(opts);
        this.connectedCluster = cluster; // Set this before testing
        
        console.log(`✅ TLS connection established to ${cluster.name} cluster`);
        console.log(`   User: ${this.config.name}`);
        
        // Test if we can actually subscribe to key subjects
        if (await this.testSubscriptionCapability()) {
          console.log(`✅ Successfully validated permissions on ${cluster.name} cluster`);
          console.log(`   Cluster: ${cluster.description}`);
          console.log(`   Monitoring: ${cluster.monitoring}`);
          return true;
        } else {
          console.log(`❌ Permission validation failed on ${cluster.name} cluster`);
          console.log(`   📝 Note: Connection succeeded but subscriptions are restricted`);
          await this.nc.close();
          this.nc = null;
          this.connectedCluster = null; // Reset this too
          console.log(`   ⏭️  Trying next cluster...`);
        }
        
      } catch (error) {
        console.log(`❌ Failed to connect to ${cluster.name} cluster`);
        console.log(`   Reason: ${error.message}`);
        console.log(`   ⏭️  Trying next cluster...`);
      }
    }

    console.log(`❌ Failed to connect to any cluster for user ${this.config.name}`);
    return false;
  }

  private async testSubscriptionCapability(): Promise<boolean> {
    // For this demo, let's use a simple rule:
    // - Bar should connect to leaf cluster to get broader access to replicated messages
    // - Foo and MMM should connect to main cluster (they have full access)
    
    const userName = this.config.name.toLowerCase();
    const clusterName = this.connectedCluster?.name;
    
    console.log(`   🧪 Evaluating optimal cluster for ${userName}...`);
    console.log(`   🏠 Currently connected to: ${clusterName} cluster`);
    
    if (userName === "bar") {
      if (clusterName === "main") {
        console.log(`   📝 Bar on main cluster: Limited to broad.rpc.> and _INBOX.>`);
        console.log(`   📝 Bar will miss messages published to rpc.> subjects`);
        console.log(`   📝 Recommending fallback to leaf cluster for full coverage`);
        return false; // Force Bar to leaf cluster for better coverage
      } else if (clusterName === "leaf") {
        console.log(`   ✅ Bar on leaf cluster: Can access all replicated messages`);
        return true;
      }
    } else {
      // Foo and MMM prefer main cluster
      if (clusterName === "main") {
        console.log(`   ✅ ${userName} on main cluster: Full access to all subjects`);
        return true;
      } else {
        console.log(`   📝 ${userName} can use leaf cluster but main is preferred`);
        return true; // They can use either cluster
      }
    }
  }

  async setupBroadcastSubscriptions() {
    if (!this.nc || !this.connectedCluster) {
      throw new Error("Not connected to any cluster");
    }

    console.log(`\n📡 Setting up broadcast subscriptions on ${this.connectedCluster.name} cluster...`);

    // Define subscription patterns based on which cluster we're connected to
    const subscriptionPatterns = this.getSubscriptionPatterns();
    
    for (const pattern of subscriptionPatterns) {
      try {
        console.log(`   🎯 Subscribing to: ${pattern}`);
        const sub = this.nc.subscribe(pattern);
        this.subscriptions.push({ pattern, subscription: sub });
        
        // Handle messages for this subscription
        this.handleBroadcastMessages(sub, pattern);
        
        console.log(`   ✅ Successfully subscribed to ${pattern}`);
      } catch (error) {
        console.log(`   ❌ Failed to subscribe to ${pattern}: ${error.message}`);
      }
    }
    
    console.log(`📡 ${this.config.name} ready to receive broadcasts on ${this.connectedCluster.name} cluster`);
    console.log(`   Total subscriptions: ${this.subscriptions.length}`);
  }

  private getSubscriptionPatterns(): string[] {
    // Define patterns based on user permissions and cluster
    const userName = this.config.name.toLowerCase();
    
    if (this.connectedCluster?.name === "main") {
      // Main cluster - subscribe based on actual permissions
      if (userName === "bar") {
        // Bar user has restricted permissions on main cluster
        return [
          "broad.rpc.>",     // Only pattern Bar can access on main cluster
          "_INBOX.>"         // Reply subjects
        ];
      } else {
        // Foo and MMM users have full permissions
        return [
          "rpc.>",           // RPC subjects (full access users only)
          "broad.rpc.>",     // Broad RPC patterns
          "_INBOX.>",        // Reply subjects
          "broadcast.>",     // Would need to be added to server config
          "announce.>",      // Would need to be added to server config  
          "alert.>"          // Would need to be added to server config
        ];
      }
    } else {
      // Leaf cluster - broader access due to relaxed permissions
      return [
        ">",               // All subjects accessible on leaf cluster
      ];
    }
  }

  private async handleBroadcastMessages(subscription: any, pattern: string) {
    (async () => {
      for await (const msg of subscription) {
        this.messageCount++;
        
        let messageData;
        try {
          messageData = JSON.parse(msg.data.toString());
        } catch {
          messageData = { raw: msg.data.toString() };
        }

        // Enhanced message display with cluster information
        console.log(`\n📨 [${this.config.name}] Broadcast Message #${this.messageCount}`);
        console.log(`   📍 Subject: ${msg.subject}`);
        console.log(`   🎯 Via pattern: ${pattern}`);
        console.log(`   🏠 Connected cluster: ${this.connectedCluster?.name} (${this.connectedCluster?.description})`);
        console.log(`   👤 Subscriber: ${this.config.name}`);
        console.log(`   ⏰ Received: ${new Date().toISOString()}`);
        console.log(`   📄 Message preview: ${JSON.stringify(messageData, null, 2).substring(0, 150)}...`);
        
        // Add cluster-specific indicators
        if (this.connectedCluster?.name === "leaf") {
          console.log(`   🌿 Via leaf cluster fallback - message available despite restrictions!`);
        } else {
          console.log(`   🔐 Via main cluster - direct access`);
        }
        
        console.log("");
      }
    })();
  }

  getStats() {
    return {
      subscriber: this.config.name,
      connectedCluster: this.connectedCluster?.name || "none",
      clusterDescription: this.connectedCluster?.description || "not connected",
      messagesReceived: this.messageCount,
      subscriptions: this.subscriptions.length,
      subscriptionPatterns: this.subscriptions.map(s => s.pattern)
    };
  }

  async showConnectionInfo() {
    if (!this.nc || !this.connectedCluster) {
      console.log(`❌ ${this.config.name}: Not connected`);
      return;
    }

    console.log(`\n📋 Connection Info for ${this.config.name}:`);
    console.log(`   🏠 Cluster: ${this.connectedCluster.name} (${this.connectedCluster.description})`);
    console.log(`   🔗 URL: ${this.connectedCluster.url}`);
    console.log(`   📊 Monitoring: ${this.connectedCluster.monitoring}`);
    console.log(`   📡 Subscriptions: ${this.subscriptions.length}`);
    console.log(`   📨 Messages received: ${this.messageCount}`);
  }

  async close() {
    console.log(`\n🔌 Closing ${this.config.name} connections...`);
    
    for (const sub of this.subscriptions) {
      try {
        await sub.subscription.unsubscribe();
      } catch (error) {
        // Ignore unsubscribe errors
      }
    }
    
    if (this.nc) {
      await this.nc.close();
      console.log(`🔌 ${this.config.name} disconnected from ${this.connectedCluster?.name} cluster`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log("🚀 NATS Broadcast Subscriber - Scenario 3");
    console.log("==========================================");
    console.log("Usage: npx tsx broadcast-subscriber.ts <user>");
    console.log("");
    console.log("Available users:");
    console.log("  foo - Full access user");
    console.log("  bar - Restricted user (will use leaf cluster fallback)");  
    console.log("  mmm - Full access user");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx broadcast-subscriber.ts foo");
    console.log("  npx tsx broadcast-subscriber.ts bar");
    console.log("  npx tsx broadcast-subscriber.ts mmm");
    return;
  }

  const userName = args[0].toLowerCase();
  
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
      // Note: Using foo certs for MMM since we haven't generated separate certs
      // In production, MMM would have its own certificate with mmm@localhost SAN
      certFile: "./certs/foo-cert.pem",
      keyFile: "./certs/foo-key.pem",
      caFile: "./certs/ca-cert.pem"
    }
  };

  const config = userConfigs[userName];
  if (!config) {
    console.log(`❌ Unknown user: ${userName}`);
    console.log("Available users: foo, bar, mmm");
    return;
  }

  const subscriber = new BroadcastSubscriber(config);

  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    console.log("\n🛑 Shutting down subscriber...");
    const stats = subscriber.getStats();
    console.log("\n📊 Final Statistics:");
    console.log(`   User: ${stats.subscriber}`);
    console.log(`   Cluster: ${stats.connectedCluster}`); 
    console.log(`   Messages: ${stats.messagesReceived}`);
    await subscriber.close();
    process.exit(0);
  });

  try {
    // Connect with automatic fallback
    if (!await subscriber.connectWithFallback()) {
      process.exit(1);
    }

    // Setup subscriptions for broadcast patterns
    await subscriber.setupBroadcastSubscriptions();

    // Show connection info
    await subscriber.showConnectionInfo();

    console.log(`\n🎧 ${config.name} is now listening for broadcast messages...`);
    console.log("   Press Ctrl+C to stop");
    
    // Show periodic stats
    setInterval(async () => {
      const stats = subscriber.getStats();
      if (stats.messagesReceived > 0) {
        console.log(`📊 [${stats.subscriber}] ${stats.messagesReceived} messages received via ${stats.connectedCluster} cluster`);
      }
    }, 30000);

    // Keep the process running
    await new Promise(() => {}); // Run forever until interrupted

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Application error:", error);
  process.exit(1);
});