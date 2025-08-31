#!/usr/bin/env node

// NATS Publisher POC - Request with Fallback Test
// This script attempts to publish to a primary subject, then falls back to an alternative

import { connect, ConnectionOptions, NatsConnection, NatsError } from "nats";
import { readFileSync } from "fs";

interface UserConfig {
  name: string;
  certFile: string;
  keyFile: string;
  caFile: string;
  server: string;
}

interface PublishConfig {
  user: UserConfig;
  primarySubject: string;
  fallbackSubject: string;
  scenario: string;
  requestTimeout: number;
}

class NATSPublisher {
  private nc: NatsConnection | null = null;
  private config: PublishConfig;

  constructor(config: PublishConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const opts: ConnectionOptions = {
        servers: [this.config.user.server],
        tls: {
          cert: readFileSync(this.config.user.certFile),
          key: readFileSync(this.config.user.keyFile),
          ca: readFileSync(this.config.user.caFile)
        },
        name: `${this.config.user.name}_publisher_${this.config.scenario}`,
        timeout: 5000,
        reconnect: true,
        maxReconnectAttempts: 5,
        verbose: false,
        debug: false
      };

      console.log(`🔌 Connecting to NATS server as user: ${this.config.user.name}`);
      this.nc = await connect(opts);
      
      console.log(`✅ Connected to NATS server: ${this.nc.getServer()}`);
      
      // Monitor connection status
      this.monitorConnection();
      
    } catch (error) {
      console.error(`❌ Failed to connect to NATS server:`, error);
      throw error;
    }
  }

  private monitorConnection(): void {
    if (!this.nc) return;

    // Monitor connection status
    (async () => {
      for await (const status of this.nc!.status()) {
        switch (status.type) {
          case 'disconnect':
            console.log(`⚠️  Disconnected from server: ${status.data}`);
            break;
          case 'reconnect':
            console.log(`🔄 Reconnected to server: ${status.data}`);
            break;
          case 'error':
            console.log(`‼️  Connection error: ${status.data}`);
            break;
        }
      }
    })();
  }

  async publishWithFallback(message: string): Promise<void> {
    if (!this.nc) {
      throw new Error('Not connected to NATS server');
    }

    const timestamp = new Date().toISOString();
    const messageData = JSON.stringify({
      message,
      user: this.config.user.name,
      scenario: this.config.scenario,
      timestamp,
      attempt: 1
    });

    console.log(`📤 Attempting to publish message...`);
    console.log(`   📋 Message: ${message}`);
    console.log(`   👤 User: ${this.config.user.name}`);
    console.log(`   🕒 Timestamp: ${timestamp}`);
    console.log('');

    // First, try the primary subject
    console.log(`🎯 Attempt 1: Trying primary subject "${this.config.primarySubject}"`);
    
    try {
      const response = await this.nc.request(
        this.config.primarySubject,
        messageData,
        { timeout: this.config.requestTimeout }
      );

      const responseData = response.string();
      console.log(`✅ SUCCESS: Primary subject responded!`);
      console.log(`   📍 Subject: ${this.config.primarySubject}`);
      console.log(`   📄 Response: ${responseData}`);
      console.log(`   ⚡ Response time: < ${this.config.requestTimeout}ms`);
      console.log('');
      
      return; // Success, no need for fallback

    } catch (error) {
      const errorMsg = error.message || error.toString();
      console.log(`⚠️  Primary subject failed: ${errorMsg}`);
      
      if (errorMsg.includes('no responders')) {
        console.log(`   🔄 Reason: No active subscribers on ${this.config.primarySubject}`);
      } else if (errorMsg.includes('timeout')) {
        console.log(`   🔄 Reason: Request timeout (${this.config.requestTimeout}ms)`);
      } else if (errorMsg.includes('Permissions Violation')) {
        console.log(`   🚫 Reason: Permission denied - user lacks publish access`);
      } else if (errorMsg.includes('503')) {
        console.log(`   🚫 Reason: NoResponder Error`);
      } else {
        console.log(`   🔄 Reason: ${errorMsg}`);
      }
      console.log('');
    }

    // Fallback to alternative subject
    console.log(`🎯 Attempt 2: Trying fallback subject "${this.config.fallbackSubject}"`);
    
    const fallbackMessageData = JSON.stringify({
      message,
      user: this.config.user.name,
      scenario: this.config.scenario,
      timestamp,
      attempt: 2,
      fallback: true,
      originalSubject: this.config.primarySubject
    });

    try {
      const response = await this.nc.request(
        this.config.fallbackSubject,
        fallbackMessageData,
        { timeout: this.config.requestTimeout }
      );

      const responseData = response.string();
      console.log(`✅ SUCCESS: Fallback subject responded!`);
      console.log(`   📍 Subject: ${this.config.fallbackSubject}`);
      console.log(`   📄 Response: ${responseData}`);
      console.log(`   ⚡ Response time: < ${this.config.requestTimeout}ms`);
      console.log(`   📝 Note: Message was routed via fallback`);
      console.log('');

    } catch (error) {
      const errorMsg = error.message || error.toString();
      console.log(`❌ FAILED: Fallback subject also failed!`);
      console.log(`   📍 Subject: ${this.config.fallbackSubject}`);
      
      if (errorMsg.includes('no responders')) {
        console.log(`   🔄 Reason: No active subscribers on ${this.config.fallbackSubject}`);
      } else if (errorMsg.includes('timeout')) {
        console.log(`   🔄 Reason: Request timeout (${this.config.requestTimeout}ms)`);
      } else if (errorMsg.includes('Permissions Violation') || errorMsg.includes('503')) {
        console.log(`   🚫 Reason: Permission denied - user lacks publish access`);
      } else {
        console.log(`   🔄 Reason: ${errorMsg}`);
      }
      console.log(`   ⚠️  Both primary and fallback subjects are unavailable/unauthorized`);
      console.log('');
      throw new Error(`Both primary (${this.config.primarySubject}) and fallback (${this.config.fallbackSubject}) subjects failed: ${errorMsg}`);
    }
  }

  async publishSimple(subject: string, message: string): Promise<void> {
    if (!this.nc) {
      throw new Error('Not connected to NATS server');
    }

    const timestamp = new Date().toISOString();
    const messageData = JSON.stringify({
      message,
      user: this.config.user.name,
      scenario: this.config.scenario,
      timestamp,
      publishOnly: true
    });

    console.log(`📤 Publishing message to ${subject}...`);
    
    try {
      this.nc.publish(subject, messageData);
      console.log(`✅ Message published successfully`);
      console.log(`   📍 Subject: ${subject}`);
      console.log(`   📄 Message: ${message}`);
      console.log(`   👤 User: ${this.config.user.name}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to publish message:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.nc) {
      try {
        await this.nc.drain();
        console.log('✅ Connection closed gracefully');
      } catch (error) {
        console.error('❌ Error closing connection:', error);
      }
    }
  }
}

// Configuration for different scenarios
const scenarios: Record<string, PublishConfig> = {
  'scenario1': {
    user: {
      name: 'Bar',
      certFile: './certs/bar-cert.pem',
      keyFile: './certs/bar-key.pem',
      caFile: './certs/ca-cert.pem',
      server: 'tls://localhost:4222'
    },
    primarySubject: 'rpc.hello.world',
    fallbackSubject: 'broad.rpc.hello.world',
    scenario: 'Scenario 1 - Bar user publishing with fallback',
    requestTimeout: 2000
  },
  'scenario2': {
    user: {
      name: 'Foo',
      certFile: './certs/foo-cert.pem',
      keyFile: './certs/foo-key.pem',
      caFile: './certs/ca-cert.pem',
      server: 'tls://localhost:4222'
    },
    primarySubject: 'rpc.hello.world',
    fallbackSubject: 'broad.rpc.hello.world',
    scenario: 'Scenario 2 - Foo user publishing',
    requestTimeout: 2000
  }
};

async function runInteractiveMode(publisher: NATSPublisher, config: PublishConfig) {
  console.log('🔄 Interactive Mode - Enter messages to publish');
  console.log('💡 Commands:');
  console.log('   - Type a message and press Enter to use request/fallback pattern');
  console.log('   - Type "simple:<subject>:<message>" to publish without request');
  console.log('   - Type "exit" or "quit" to stop');
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('💬 Enter message (or "exit" to quit):');
  
  for await (const input of rl) {
    
    if (input === 'exit' || input === 'quit') {
      console.log('👋 Exiting interactive mode...');
      rl.close();
      break;
    }

    if (input.startsWith('simple:')) {
      // Parse simple publish command: simple:subject:message
      const parts = input.split(':');
      if (parts.length >= 3) {
        const subject = parts[1];
        const message = parts.slice(2).join(':');
        
        try {
          await publisher.publishSimple(subject, message);
        } catch (error) {
          console.error('❌ Simple publish failed:', error.message);
        }
      } else {
        console.log('❌ Invalid simple command format. Use: simple:<subject>:<message>');
      }
      continue;
    }

    if (input.length > 0) {
      try {
        await publisher.publishWithFallback(input);
      } catch (error) {
        console.error('❌ Request/fallback failed:', error.message);
      }
    }

    console.log('💬 Enter next message (or "exit" to quit):');
  }
  
  rl.close();
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('NATS Publisher POC');
    console.log('==================');
    console.log('');
    console.log('Usage: npx tsx publisher.ts <scenario> [message] [--interactive]');
    console.log('');
    console.log('Available scenarios:');
    console.log('  scenario1  - Bar user (TLS cert: bar-cert.pem) trying rpc.hello.world then broad.rpc.hello.world');
    console.log('  scenario2  - Foo user (TLS cert: foo-cert.pem) trying rpc.hello.world then broad.rpc.hello.world');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx publisher.ts scenario1 "Hello World"');
    console.log('  npx tsx publisher.ts scenario2 --interactive');
    console.log('  npx tsx publisher.ts scenario1');
    console.log('');
    console.log('Options:');
    console.log('  --interactive  Start in interactive mode for multiple messages');
    console.log('');
    process.exit(1);
  }

  const scenarioName = args[0];
  const config = scenarios[scenarioName];

  if (!config) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', Object.keys(scenarios).join(', '));
    process.exit(1);
  }

  const isInteractive = args.includes('--interactive');
  const message = args.find(arg => arg !== scenarioName && arg !== '--interactive') || 'Test message';

  console.log('🚀 Starting NATS Publisher POC');
  console.log('==============================');
  console.log(`📋 Scenario: ${config.scenario}`);
  console.log(`👤 User: ${config.user.name} (${config.user.certFile})`);
  console.log(`🎯 Primary Subject: ${config.primarySubject}`);
  console.log(`🔄 Fallback Subject: ${config.fallbackSubject}`);
  console.log(`⏱️  Request Timeout: ${config.requestTimeout}ms`);
  console.log(`🎮 Interactive Mode: ${isInteractive ? 'Yes' : 'No'}`);
  console.log('');

  const publisher = new NATSPublisher(config);

  try {
    await publisher.connect();

    if (isInteractive) {
      await runInteractiveMode(publisher, config);
    } else {
      console.log(`📤 Publishing single message: "${message}"`);
      console.log('');
      await publisher.publishWithFallback(message);
    }

  } catch (error) {
    console.error('❌ Publisher failed:', error);
  } finally {
    await publisher.close();
    console.log('👋 Publisher stopped');
  }
}

// Run the main function
main();
