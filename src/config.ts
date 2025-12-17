import { config } from 'dotenv';
import { Cluster } from '@solana/web3.js';

// Try to load script.env first, fallback to .env
config({ path: 'script.env' });
config(); // fallback to .env

export interface AppConfig {
  network: Cluster;
  rpcUrl: string;
  privateKey: string;
  totalRecipients: number;
  tokensPerRecipient: number;
  recipientsPerTx: number;
}

export function getConfig(): AppConfig {
  const network = (process.env.NETWORK || 'devnet') as Cluster;
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const privateKey = process.env.PRIVATE_KEY || '';

  const totalRecipients = parseInt(process.env.TOTAL_RECIPIENTS || '5000', 10);
  const tokensPerRecipient = parseFloat(process.env.TOKENS_PER_RECIPIENT || '0.8');
  const recipientsPerTx = parseInt(process.env.RECIPIENTS_PER_TX || '10', 10);

  return {
    network,
    rpcUrl,
    privateKey,
    totalRecipients,
    tokensPerRecipient,
    recipientsPerTx,
  };
}

export function validateConfig(cfg: AppConfig): void {
  if (!cfg.privateKey || cfg.privateKey === 'your_private_key_here') {
    console.log('\n⚠️  Private key not specified in .env');
    console.log('   A new test wallet will be created for devnet\n');
  }

  if (cfg.recipientsPerTx > 10) {
    console.log('⚠️  recipientsPerTx > 10 may cause transaction size errors');
    console.log('   Recommended: 8-10\n');
  }

  if (cfg.totalRecipients > 50000) {
    console.log('⚠️  More than 50,000 recipients will take a long time and cost a lot of SOL\n');
  }
}
