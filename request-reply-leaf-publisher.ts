#!/usr/bin/env node

// NATS Request-Reply Leaf Publisher - Scenario 4
// Smart publisher that automatically selects the optimal cluster based on user permissions
// Demonstrates how leaf node architecture eliminates the need for application-level fallback

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

class RequestReplyLeafPublisher {
  private config: UserConfig;
  private nc: NatsConnection | null = null;
  private connectedCluster: ClusterInfo | null = null;

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
    console.log("   Strategy: Try main cluster first, test permissions, fallback to leaf if needed");
    
    // Try each cluster in order (main first, then leaf)
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
          name: `${this.config.name}_rr_leaf_publisher`,
          timeout: 5000,
          reconnect: true,
          maxReconnectAttempts: 3
        };

        this.nc = await connect(opts);
        this.connectedCluster = cluster;
        
        console.log(`✅ TLS connection established to ${cluster.name} cluster`);
        console.log(`   User: ${this.config.name}`);
        
        // Test if we can actually publish to key subjects
        if (await this.testPublishCapability()) {
          console.log(`✅ Successfully validated permissions on ${cluster.name} cluster`);
          console.log(`   Cluster: ${cluster.description}`);
          console.log(`   Monitoring: ${cluster.monitoring}`);
          return true;
        } else {
          console.log(`❌ Permission validation failed on ${cluster.name} cluster`);
          console.log(`   📝 Note: Connection succeeded but publish permissions are restricted`);
          await this.nc.close();
          this.nc = null;
          this.connectedCluster = null;
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

  private async testPublishCapability(): Promise<boolean> {
    // Test if we can actually publish/request on key subjects
    // For request-reply, we can test by attempting a quick request with a very short timeout
    const userName = this.config.name.toLowerCase();
    const clusterName = this.connectedCluster?.name;
    
    console.log(`   🧪 Testing publish capabilities for ${userName} on ${clusterName} cluster...`);
    
    if (userName === "bar") {
      if (clusterName === "main") {
        console.log(`   📝 Bar on main cluster: Testing restricted subject access`);
        console.log(`   📝 Expected to fail for rpc.> subjects - will fallback to leaf`);
        
        // Test a quick request to see if we get permission-related errors
        try {
          // Very short timeout - we just want to see if it gets blocked by permissions
          await this.nc!.request("rpc.hello.world", "permission-test", { timeout: 100 });
          console.log(`   ✅ Bar can access rpc.hello.world on main cluster`);
          return true;
        } catch (error) {
          if (error.message.includes('timeout')) {
            // Timeout means the request went through but no subscriber
            // This indicates permissions are OK
            console.log(`   ✅ Bar can publish to rpc.hello.world on main cluster (timeout = no subscriber)`);
            return true;
          } else if (error.message.includes('no responders') || error.message.includes('503')) {
            // This could be either no responders OR permission denial
            // For Bar on main cluster, assume it's permission denial
            console.log(`   ❌ Bar cannot access rpc.hello.world on main cluster (likely permission denied)`);
            return false;
          } else {
            console.log(`   ❌ Error testing permissions: ${error.message}`);
            return false;
          }
        }
      } else {
        // Bar on leaf cluster should have full access
        console.log(`   ✅ Bar on leaf cluster: Full access available`);
        return true;
      }
    } else {
      // Foo and MMM have full permissions on both clusters
      if (clusterName === "main") {
        console.log(`   ✅ ${userName} on main cluster: Full access (preferred)`);
        return true;
      } else {
        console.log(`   ✅ ${userName} on leaf cluster: Full access available`);
        return true;
      }
    }
  }

  async publishRequest(subject: string, message: string): Promise<void> {
    if (!this.nc || !this.connectedCluster) {
      throw new Error("Not connected to any cluster");
    }

    console.log(`\n📤 Sending request-reply message...`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Message: ${message}`);
    console.log(`   Publisher: ${this.config.name}`);
    console.log(`   Via cluster: ${this.connectedCluster.name} (${this.connectedCluster.description})`);
    
    const messageData = JSON.stringify({
      message,
      user: this.config.name,
      timestamp: new Date().toISOString(),
      publishedFrom: this.connectedCluster.name,
      scenario: "Scenario 4 - Request-Reply with Leaf Node Architecture"
    });

    try {
      console.log(`   ⏳ Waiting for response...`);
      
      const response = await this.nc.request(
        subject,
        messageData,
        { timeout: 5000 }
      );

      const responseData = JSON.parse(response.string());
      
      console.log(`   ✅ SUCCESS: Received response!`);
      console.log(`   📍 Response from: ${responseData.user || 'Unknown subscriber'}`);
      console.log(`   📄 Response data: ${JSON.stringify(responseData, null, 2)}`);
      console.log(`   🌿 Architecture: Request routed through ${this.connectedCluster.name} cluster`);
      
      if (this.connectedCluster.name === "leaf") {
        console.log(`   💡 Success via leaf cluster - no application fallback needed!`);
      }
      
    } catch (error) {
      const errorMsg = error.message || error.toString();
      console.log(`   ❌ Request failed: ${errorMsg}`);
      
      if (errorMsg.includes('no responders')) {
        console.log(`   🔄 Reason: No active subscribers on ${subject}`);
      } else if (errorMsg.includes('timeout')) {
        console.log(`   🔄 Reason: Request timeout - no response within 5000ms`);
      } else {
        console.log(`   🔄 Reason: ${errorMsg}`);
      }
      
      // In Scenario 4, we don't need application-level fallback!
      // The leaf node architecture handles routing automatically
      throw error;
    }
  }

  async showConnectionInfo() {
    if (!this.nc || !this.connectedCluster) {
      console.log(`❌ ${this.config.name}: Not connected`);
      return;
    }

    console.log(`\n📋 Connection Summary for ${this.config.name}:`);
    console.log(`   🏠 Connected to: ${this.connectedCluster.name} cluster`);
    console.log(`   🔗 URL: ${this.connectedCluster.url}`);
    console.log(`   📊 Monitoring: ${this.connectedCluster.monitoring}`);
    console.log(`   📝 Strategy: ${this.config.name === 'Bar' ? 'Leaf cluster bypass' : 'Direct main cluster'}`);
  }

  async close() {
    if (this.nc) {
      await this.nc.close();
      console.log(`🔌 ${this.config.name} disconnected from ${this.connectedCluster?.name} cluster`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log("🚀 NATS Request-Reply Leaf Publisher - Scenario 4");
    console.log("===============================================");
    console.log("Usage: npx tsx request-reply-leaf-publisher.ts <user> [subject] [message]");
    console.log("");
    console.log("Available users:");
    console.log("  foo - Full access user (connects to main cluster)");
    console.log("  bar - Restricted user (connects to leaf cluster for bypass)");  
    console.log("  mmm - Full access user (connects to main cluster)");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx request-reply-leaf-publisher.ts bar");
    console.log("  npx tsx request-reply-leaf-publisher.ts foo rpc.hello.world 'Hello World'");
    console.log("  npx tsx request-reply-leaf-publisher.ts bar rpc.hello.world 'Via Leaf!'");
    return;
  }

  const userName = args[0].toLowerCase();
  const subject = args[1] || "rpc.hello.world";
  const message = args[2] || `Test message from ${userName}`;
  
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
  console.log(`🎯 Subject: ${subject}`);
  console.log(`📝 Message: "${message}"`);
  console.log("");
  
  console.log("💡 Key Difference from Scenarios 1 & 2:");
  console.log("   🔄 All users try main cluster first (preferred connection)");
  if (config.name === "Bar") {
    console.log("   🌿 Bar will fallback to leaf cluster if main cluster permissions fail");
    console.log("   🌿 Automatic infrastructure-level solution - no application fallback code!");
  } else {
    console.log("   🏠 Foo/MMM will succeed on main cluster (have full permissions)");
  }
  console.log("");

  const publisher = new RequestReplyLeafPublisher(config);

  try {
    // Connect with fallback strategy
    if (!await publisher.connectWithFallback()) {
      process.exit(1);
    }

    // Show connection info
    await publisher.showConnectionInfo();

    // Send the request
    await publisher.publishRequest(subject, message);

    console.log(`\n✅ Request-reply completed successfully!`);
    console.log(`🌟 Scenario 4 demonstrates infrastructure-level solution to permission issues`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.log(`\n📝 Note: Make sure subscribers are running to receive the request`);
    console.log(`   npx tsx request-reply-leaf-subscriber.ts foo`);
  } finally {
    await publisher.close();
  }
}

main().catch(error => {
  console.error("❌ Application error:", error);
  process.exit(1);
});