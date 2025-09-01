#!/usr/bin/env node

// NATS Request-Reply Leaf Subscriber - Scenario 4
// Cluster-aware subscriber that handles requests from both main and leaf clusters
// Demonstrates how leaf node architecture enables seamless request-reply across clusters

import { connect, ConnectionOptions, NatsConnection, Subscription } from "nats";
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

class RequestReplyLeafSubscriber {
  private config: UserConfig;
  private nc: NatsConnection | null = null;
  private connectedCluster: ClusterInfo | null = null;
  private subscriptions: Subscription[] = [];
  private messageCount = 0;

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

  async connectToCluster(clusterName?: string): Promise<boolean> {
    // Subscribers typically connect to main cluster (where business logic lives)
    // But they can also connect to leaf cluster for testing
    const targetCluster = clusterName ? 
      this.clusters.find(c => c.name === clusterName) :
      this.clusters.find(c => c.name === "main");
    
    if (!targetCluster) {
      console.log(`❌ Unknown cluster: ${clusterName}`);
      return false;
    }
    
    console.log(`🔗 Connecting ${this.config.name} to ${targetCluster.name} cluster...`);
    console.log(`   URL: ${targetCluster.url}`);
    console.log(`   Description: ${targetCluster.description}`);
    
    try {
      const opts: ConnectionOptions = {
        servers: [targetCluster.url],
        tls: {
          cert: readFileSync(this.config.certFile),
          key: readFileSync(this.config.keyFile),
          ca: readFileSync(this.config.caFile)
        },
        name: `${this.config.name}_rr_leaf_subscriber`,
        timeout: 5000,
        reconnect: true,
        maxReconnectAttempts: 3
      };

      this.nc = await connect(opts);
      this.connectedCluster = targetCluster;
      
      console.log(`✅ Connected to ${targetCluster.name} cluster`);
      console.log(`   User: ${this.config.name}`);
      console.log(`   Monitoring: ${targetCluster.monitoring}`);
      
      return true;
      
    } catch (error) {
      console.log(`❌ Failed to connect to ${targetCluster.name} cluster: ${error.message}`);
      return false;
    }
  }

  async setupRequestHandlers(): Promise<void> {
    if (!this.nc || !this.connectedCluster) {
      throw new Error("Not connected to any cluster");
    }

    console.log(`\n📡 Setting up request handlers on ${this.connectedCluster.name} cluster...`);

    // Define subjects to listen on based on user permissions
    const subjects = this.getSubscriptionSubjects();
    
    for (const subject of subjects) {
      try {
        console.log(`   🎯 Creating handler for: ${subject}`);
        const sub = this.nc.subscribe(subject);
        this.subscriptions.push(sub);
        
        // Handle requests for this subscription
        this.handleRequests(sub, subject);
        
        console.log(`   ✅ Handler ready for ${subject}`);
      } catch (error) {
        console.log(`   ❌ Failed to subscribe to ${subject}: ${error.message}`);
      }
    }
    
    console.log(`\n📡 ${this.config.name} ready to handle requests on ${this.connectedCluster.name} cluster`);
    console.log(`   Total handlers: ${this.subscriptions.length}`);
    console.log(`   💡 Can handle requests from publishers on ANY cluster (main or leaf)`);
  }

  private getSubscriptionSubjects(): string[] {
    // Define subjects based on user permissions
    const userName = this.config.name.toLowerCase();
    
    if (userName === "bar") {
      // Bar user has restricted permissions on main cluster
      if (this.connectedCluster?.name === "main") {
        return [
          "broad.rpc.>",     // Only pattern Bar can handle on main cluster
          "_INBOX.>"         // Reply subjects
        ];
      } else {
        // Bar has full access on leaf cluster
        return [
          "rpc.>",           // All RPC subjects
          "broad.rpc.>",     // Broad RPC patterns  
          "_INBOX.>"         // Reply subjects
        ];
      }
    } else {
      // Foo and MMM users have full permissions on both clusters
      return [
        "rpc.>",           // All RPC subjects
        "broad.rpc.>",     // Broad RPC patterns
        "_INBOX.>"         // Reply subjects
      ];
    }
  }

  private async handleRequests(subscription: Subscription, pattern: string): Promise<void> {
    (async () => {
      for await (const msg of subscription) {
        this.messageCount++;
        
        let requestData;
        try {
          requestData = JSON.parse(msg.data.toString());
        } catch {
          requestData = { raw: msg.data.toString() };
        }

        console.log(`\n📨 [${this.config.name}] Request #${this.messageCount}`);
        console.log(`   📍 Subject: ${msg.subject}`);
        console.log(`   🎯 Via pattern: ${pattern}`);
        console.log(`   🏠 Subscriber cluster: ${this.connectedCluster?.name} (${this.connectedCluster?.description})`);
        console.log(`   👤 From: ${requestData.user || 'Unknown'}`);
        console.log(`   🌿 Publisher cluster: ${requestData.publishedFrom || 'Unknown'}`);
        console.log(`   ⏰ Received: ${new Date().toISOString()}`);
        console.log(`   📄 Request: ${requestData.message || 'No message'}`);
        
        // Highlight cross-cluster communication
        if (requestData.publishedFrom && requestData.publishedFrom !== this.connectedCluster?.name) {
          console.log(`   🌉 Cross-cluster request! ${requestData.publishedFrom} → ${this.connectedCluster?.name}`);
        }

        // Send reply if reply subject is provided
        if (msg.reply) {
          try {
            const replyData = {
              status: 'success',
              respondedBy: this.config.name,
              respondedFrom: this.connectedCluster?.name,
              respondedAt: new Date().toISOString(),
              originalRequest: requestData,
              receivedSubject: msg.subject,
              subscribedVia: pattern,
              scenario: "Scenario 4 - Request-Reply with Leaf Node Architecture"
            };

            this.nc!.publish(msg.reply, JSON.stringify(replyData, null, 2));
            console.log(`   ✅ Reply sent to: ${msg.reply}`);
            
            if (requestData.publishedFrom && requestData.publishedFrom !== this.connectedCluster?.name) {
              console.log(`   🌉 Reply routed back: ${this.connectedCluster?.name} → ${requestData.publishedFrom}`);
            }
            
          } catch (replyError) {
            console.error(`   ❌ Failed to send reply: ${replyError.message}`);
          }
        } else {
          console.log(`   📝 No reply address provided`);
        }
        
        console.log("");
      }
    })();
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
    console.log(`   📡 Handlers: ${this.subscriptions.length}`);
    console.log(`   📨 Requests handled: ${this.messageCount}`);
    console.log(`   💡 Can receive requests from publishers on both main and leaf clusters`);
  }

  getStats() {
    return {
      subscriber: this.config.name,
      connectedCluster: this.connectedCluster?.name || "none",
      clusterDescription: this.connectedCluster?.description || "not connected",
      requestsHandled: this.messageCount,
      handlers: this.subscriptions.length,
      handlerPatterns: this.getSubscriptionSubjects()
    };
  }

  async close() {
    console.log(`\n🔌 Closing ${this.config.name} request handlers...`);
    
    for (const sub of this.subscriptions) {
      try {
        await sub.unsubscribe();
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
    console.log("🚀 NATS Request-Reply Leaf Subscriber - Scenario 4");
    console.log("================================================");
    console.log("Usage: npx tsx request-reply-leaf-subscriber.ts <user> [cluster]");
    console.log("");
    console.log("Available users:");
    console.log("  foo - Full access user");
    console.log("  bar - Restricted user (limited on main, full on leaf)");  
    console.log("  mmm - Full access user");
    console.log("");
    console.log("Available clusters:");
    console.log("  main - Main restrictive cluster (default)");
    console.log("  leaf - Leaf broadcast relay cluster");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx request-reply-leaf-subscriber.ts foo");
    console.log("  npx tsx request-reply-leaf-subscriber.ts bar main");
    console.log("  npx tsx request-reply-leaf-subscriber.ts foo leaf");
    return;
  }

  const userName = args[0].toLowerCase();
  const clusterName = args[1] || "main";
  
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
      certFile: "./certs/mmm-cert.pem",
      keyFile: "./certs/mmm-key.pem",
      caFile: "./certs/ca-cert.pem"
    }
  };

  const config = userConfigs[userName];
  if (!config) {
    console.log(`❌ Unknown user: ${userName}`);
    console.log("Available users: foo, bar, mmm");
    return;
  }

  console.log("🚀 NATS Request-Reply with Leaf Node Architecture - Scenario 4");
  console.log("============================================================");
  console.log(`👤 User: ${config.name}`);
  console.log(`🏠 Target cluster: ${clusterName}`);
  console.log("");
  console.log("💡 Purpose: Handle requests from publishers on ANY cluster (main or leaf)");
  console.log("🌉 Demonstrates seamless cross-cluster request-reply communication");
  console.log("");

  const subscriber = new RequestReplyLeafSubscriber(config);

  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    console.log("\n🛑 Shutting down subscriber...");
    const stats = subscriber.getStats();
    console.log("\n📊 Final Statistics:");
    console.log(`   User: ${stats.subscriber}`);
    console.log(`   Cluster: ${stats.connectedCluster}`); 
    console.log(`   Requests handled: ${stats.requestsHandled}`);
    await subscriber.close();
    process.exit(0);
  });

  try {
    // Connect to specified cluster
    if (!await subscriber.connectToCluster(clusterName)) {
      process.exit(1);
    }

    // Setup request handlers
    await subscriber.setupRequestHandlers();

    // Show connection info
    await subscriber.showConnectionInfo();

    console.log(`\n🎧 ${config.name} is now listening for requests on ${clusterName} cluster...`);
    console.log("   Press Ctrl+C to stop");
    console.log("");
    console.log("💡 Test with publishers:");
    console.log("   npx tsx request-reply-leaf-publisher.ts bar  # Bar via leaf cluster");
    console.log("   npx tsx request-reply-leaf-publisher.ts foo  # Foo via main cluster");
    
    // Show periodic stats
    setInterval(async () => {
      const stats = subscriber.getStats();
      if (stats.requestsHandled > 0) {
        console.log(`📊 [${stats.subscriber}] ${stats.requestsHandled} requests handled on ${stats.connectedCluster} cluster`);
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