#!/usr/bin/env -S deno run --allow-net --allow-env

// NATS Subscriber POC - Dual Subscription Test
// This script subscribes to multiple subjects and processes incoming messages

import { connect, ConnectionOptions, NatsConnection, Subscription } from "https://deno.land/x/nats@v1.28.2/src/mod.ts";

interface AccountConfig {
  name: string;
  user: string;
  pass: string;
  server: string;
}

interface SubscriberConfig {
  account: AccountConfig;
  subjects: string[];
  scenario: string;
}

class NATSSubscriber {
  private nc: NatsConnection | null = null;
  private subscriptions: Subscription[] = [];
  private messageCount = 0;
  private config: SubscriberConfig;

  constructor(config: SubscriberConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const opts: ConnectionOptions = {
        servers: [this.config.account.server],
        user: this.config.account.user,
        pass: this.config.account.pass,
        name: `${this.config.account.name}_subscriber_${this.config.scenario}`,
        timeout: 5000,
        reconnect: true,
        maxReconnectAttempts: 5,
        verbose: false,
        debug: false
      };

      console.log(`🔌 Connecting to NATS server as account: ${this.config.account.name}`);
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
            console.log(`❌ Connection error: ${status.data}`);
            break;
        }
      }
    })();
  }

  async subscribe(): Promise<void> {
    if (!this.nc) {
      throw new Error('Not connected to NATS server');
    }

    console.log(`📝 Setting up subscriptions for subjects: ${this.config.subjects.join(', ')}`);

    for (const subject of this.config.subjects) {
      try {
        const sub = this.nc.subscribe(subject);
        this.subscriptions.push(sub);

        console.log(`✅ Subscribed to: ${subject}`);

        // Process messages for this subscription
        this.processMessages(sub, subject);

      } catch (error) {
        console.error(`❌ Failed to subscribe to ${subject}:`, error);
        throw error;
      }
    }

    console.log(`🎯 All subscriptions active. Waiting for messages...`);
    console.log(`📊 Scenario: ${this.config.scenario}`);
    console.log(`👤 Account: ${this.config.account.name}`);
    console.log(`🔍 Monitoring subjects: ${this.config.subjects.join(', ')}`);
    console.log('');
  }

  private async processMessages(sub: Subscription, subject: string): Promise<void> {
    try {
      for await (const msg of sub) {
        this.messageCount++;
        
        const timestamp = new Date().toISOString();
        const msgData = msg.string();
        const reply = msg.reply || 'N/A';
        
        console.log(`📨 [${timestamp}] Message #${this.messageCount}`);
        console.log(`   📍 Subject: ${msg.subject}`);
        console.log(`   🎯 Subscribed via: ${subject}`);
        console.log(`   📄 Data: ${msgData}`);
        console.log(`   🔄 Reply-To: ${reply}`);
        console.log(`   👤 Account: ${this.config.account.name}`);
        console.log('');

        // If this is a request message, send a reply
        if (msg.reply) {
          try {
            const replyData = JSON.stringify({
              status: 'received',
              account: this.config.account.name,
              receivedSubject: msg.subject,
              subscribedVia: subject,
              timestamp: timestamp,
              originalData: msgData
            });

            this.nc!.publish(msg.reply, replyData);
            console.log(`✅ Sent reply to: ${msg.reply}`);
            console.log('');
          } catch (replyError) {
            console.error(`❌ Failed to send reply:`, replyError);
          }
        }

        // Display statistics every 10 messages
        if (this.messageCount % 10 === 0) {
          console.log(`📊 Statistics: ${this.messageCount} messages processed`);
          console.log('');
        }
      }
    } catch (error) {
      console.error(`❌ Error processing messages for ${subject}:`, error);
    }
  }

  async gracefulShutdown(): Promise<void> {
    console.log('🛑 Initiating graceful shutdown...');

    // Unsubscribe from all subjects
    for (const sub of this.subscriptions) {
      try {
        await sub.unsubscribe();
        console.log(`✅ Unsubscribed from: ${sub.getSubject()}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${sub.getSubject()}:`, error);
      }
    }

    // Close connection
    if (this.nc) {
      try {
        await this.nc.drain();
        console.log('✅ Connection drained and closed');
      } catch (error) {
        console.error('❌ Error closing connection:', error);
      }
    }

    console.log(`📊 Final Statistics: ${this.messageCount} messages processed`);
    console.log('👋 Subscriber stopped');
  }
}

// Configuration for different scenarios
const scenarios: Record<string, SubscriberConfig> = {
  'scenario1': {
    account: {
      name: 'Foo',
      user: 'foo_user',
      pass: 'foo_pass',
      server: 'nats://localhost:4222'
    },
    subjects: ['rpc.hello.world', 'broad.rpc.>'],
    scenario: 'Scenario 1 - Foo account dual subscription'
  },
  'scenario2': {
    account: {
      name: 'Bar',
      user: 'bar_user',
      pass: 'bar_pass',
      server: 'nats://localhost:4222'
    },
    subjects: ['rpc.hello.world', 'broad.rpc.>'],
    scenario: 'Scenario 2 - Bar account dual subscription'
  }
};

async function main() {
  const args = Deno.args;
  
  if (args.length === 0) {
    console.log('NATS Subscriber POC');
    console.log('==================');
    console.log('');
    console.log('Usage: deno run --allow-net --allow-env subscriber.ts <scenario>');
    console.log('');
    console.log('Available scenarios:');
    console.log('  scenario1  - Foo account subscribing to both rpc.hello.world and broad.rpc.>');
    console.log('  scenario2  - Bar account subscribing to both rpc.hello.world and broad.rpc.>');
    console.log('');
    console.log('Examples:');
    console.log('  deno run --allow-net --allow-env subscriber.ts scenario1');
    console.log('  deno run --allow-net --allow-env subscriber.ts scenario2');
    console.log('');
    Deno.exit(1);
  }

  const scenarioName = args[0];
  const config = scenarios[scenarioName];

  if (!config) {
    console.error(`❌ Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', Object.keys(scenarios).join(', '));
    Deno.exit(1);
  }

  console.log('🚀 Starting NATS Subscriber POC');
  console.log('===============================');
  console.log(`📋 Scenario: ${config.scenario}`);
  console.log(`👤 Account: ${config.account.name} (${config.account.user})`);
  console.log(`🎯 Subjects: ${config.subjects.join(', ')}`);
  console.log('');

  const subscriber = new NATSSubscriber(config);

  // Handle graceful shutdown
  const cleanup = async () => {
    await subscriber.gracefulShutdown();
    Deno.exit(0);
  };

  Deno.addSignalListener('SIGINT', cleanup);
  Deno.addSignalListener('SIGTERM', cleanup);

  try {
    await subscriber.connect();
    await subscriber.subscribe();

    // Keep the process alive
    console.log('✅ Subscriber is running. Press Ctrl+C to stop.');
    console.log('');
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Subscriber failed:', error);
    await cleanup();
    Deno.exit(1);
  }
}

// Run the main function
if (import.meta.main) {
  main();
}
