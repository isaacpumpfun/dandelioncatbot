import { Connection, Keypair } from '@solana/web3.js';
import inquirer from 'inquirer';
import { getConfig, validateConfig, AppConfig } from './config';
import { loadKeypair, createTestWallet, printWalletInfo } from './wallet';
import { getWalletTokens, formatTokenList, checkSufficientBalance, TokenInfo, createTestToken } from './tokens';
import { executeAirdrop, estimateCost } from './airdrop';
import { generateRandomAddresses, formatNumber, formatSol } from './utils';

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  DANDELION CAT                            ║');
  console.log('║           Solana Token Mass Distribution                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Load config
  const config = getConfig();
  validateConfig(config);
  
  console.log(`🌐 Network: ${config.network}`);
  console.log(`🔗 RPC: ${config.rpcUrl.slice(0, 40)}...`);
  console.log('');
  
  // Connect to network
  const connection = new Connection(config.rpcUrl, 'confirmed');
  
  // Load or create wallet
  let keypair: Keypair;
  
  if (config.privateKey && config.privateKey !== 'your_private_key_here') {
    try {
      keypair = loadKeypair(config.privateKey);
      console.log('✅ Wallet loaded from .env\n');
    } catch (error) {
      console.error('❌ Error loading wallet:', error);
      return;
    }
  } else {
    // Create test wallet for devnet
    if (config.network !== 'devnet') {
      console.error('❌ For mainnet, you must specify PRIVATE_KEY in .env');
      return;
    }
    keypair = await createTestWallet(connection);
  }
  
  // Display wallet info
  await printWalletInfo(connection, keypair);
  
  // Get tokens
  console.log('🔍 Loading tokens...\n');
  let tokens = await getWalletTokens(connection, keypair.publicKey);
  
  if (tokens.length === 0) {
    if (config.network === 'devnet') {
      console.log('⚠️  No tokens found on wallet.');
      console.log('   Creating test token for devnet...\n');
      
      const testToken = await createTestToken(connection, keypair);
      tokens = [testToken];
    } else {
      console.log('❌ No tokens found on wallet.');
      console.log('   Transfer tokens to this wallet\n');
      return;
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🪙 AVAILABLE TOKENS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(formatTokenList(tokens));
  
  // Token selection
  const { tokenIndex } = await inquirer.prompt([
    {
      type: 'number',
      name: 'tokenIndex',
      message: 'Select token number for distribution:',
      default: 1,
      validate: (input) => {
        if (input < 1 || input > tokens.length) {
          return `Enter a number from 1 to ${tokens.length}`;
        }
        return true;
      },
    },
  ]);
  
  const selectedToken = tokens[tokenIndex - 1];
  
  // Request parameters
  const params = await inquirer.prompt([
    {
      type: 'number',
      name: 'totalRecipients',
      message: 'Number of recipients:',
      default: config.totalRecipients,
      validate: (input) => input > 0 ? true : 'Must be greater than 0',
    },
    {
      type: 'number',
      name: 'tokensPerRecipient',
      message: 'Tokens per recipient:',
      default: config.tokensPerRecipient,
      validate: (input) => input > 0 ? true : 'Must be greater than 0',
    },
    {
      type: 'number',
      name: 'recipientsPerTx',
      message: 'Recipients per transaction (max 10):',
      default: config.recipientsPerTx,
      validate: (input) => {
        if (input < 1) return 'Minimum 1';
        if (input > 10) return 'Maximum 10 (transaction size limit)';
        return true;
      },
    },
  ]);
  
  // Check token balance
  const balanceCheck = checkSufficientBalance(
    selectedToken,
    params.totalRecipients,
    params.tokensPerRecipient
  );
  
  if (!balanceCheck.sufficient) {
    console.log('\n❌ Insufficient tokens!');
    console.log(`   Required: ${formatNumber(balanceCheck.required)}`);
    console.log(`   Available: ${formatNumber(balanceCheck.available)}\n`);
    return;
  }
  
  // Cost estimate
  const cost = estimateCost(params.totalRecipients, params.recipientsPerTx);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 DISTRIBUTION PLAN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Token: ${selectedToken.mint.toBase58().slice(0, 20)}...`);
  console.log(`   Recipients: ${formatNumber(params.totalRecipients)}`);
  console.log(`   Tokens per address: ${params.tokensPerRecipient}`);
  console.log(`   Total tokens: ${formatNumber(params.totalRecipients * params.tokensPerRecipient)}`);
  console.log(`   Transactions: ${Math.ceil(params.totalRecipients / params.recipientsPerTx)}`);
  console.log('');
  console.log('   💰 COST ESTIMATE:');
  console.log(`      ATA Rent: ~${cost.ataRent.toFixed(4)} SOL`);
  console.log(`      Fees:     ~${cost.fees.toFixed(6)} SOL`);
  console.log(`      TOTAL:    ~${cost.total.toFixed(4)} SOL`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check SOL balance
  const solBalance = await connection.getBalance(keypair.publicKey);
  const requiredSol = cost.total * 1e9 * 1.1; // +10% buffer
  
  if (solBalance < requiredSol) {
    console.log('❌ Insufficient SOL!');
    console.log(`   Required: ~${(requiredSol / 1e9).toFixed(4)} SOL`);
    console.log(`   Available: ${formatSol(solBalance)} SOL\n`);
    return;
  }
  
  // Confirmation
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '🚀 Start distribution?',
      default: false,
    },
  ]);
  
  if (!confirm) {
    console.log('\n👋 Cancelled by user\n');
    return;
  }
  
  // Generate addresses
  console.log('\n⏳ Generating random addresses...');
  const recipients = generateRandomAddresses(params.totalRecipients);
  console.log(`✅ Generated ${formatNumber(recipients.length)} addresses\n`);
  
  // Start distribution
  const result = await executeAirdrop(connection, keypair, {
    token: selectedToken,
    recipients,
    tokensPerRecipient: params.tokensPerRecipient,
    recipientsPerTx: params.recipientsPerTx,
  });
  
  // Display first few signatures
  if (result.signatures.length > 0) {
    console.log('📝 Sample transactions:');
    result.signatures.slice(0, 3).forEach((sig, i) => {
      const explorer = config.network === 'devnet' 
        ? `https://solscan.io/tx/${sig}?cluster=devnet`
        : `https://solscan.io/tx/${sig}`;
      console.log(`   ${i + 1}. ${explorer}`);
    });
    console.log('');
  }
  
  console.log('✅ Done!\n');
}

// Run
main().catch((error) => {
  console.error('❌ Critical error:', error);
  process.exit(1);
});
