import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { formatSol } from './utils';

/**
 * Loads a keypair from a private key (base58 or JSON array)
 */
export function loadKeypair(privateKey: string): Keypair {
  // Try base58
  try {
    const decoded = bs58.decode(privateKey);
    return Keypair.fromSecretKey(decoded);
  } catch {
    // Try JSON array
    try {
      const parsed = JSON.parse(privateKey);
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    } catch {
      throw new Error('Invalid private key format. Expected base58 or JSON array.');
    }
  }
}

/**
 * Creates a new test wallet and requests airdrop on devnet
 */
export async function createTestWallet(connection: Connection): Promise<Keypair> {
  const keypair = Keypair.generate();
  
  console.log('🔑 New test wallet created:');
  console.log(`   Address: ${keypair.publicKey.toBase58()}`);
  console.log(`   Private key (base58): ${bs58.encode(keypair.secretKey)}`);
  console.log('');
  
  console.log('💰 Requesting airdrop of 2 SOL on devnet...');
  
  try {
    const signature = await connection.requestAirdrop(
      keypair.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('✅ Airdrop received!\n');
  } catch (error) {
    console.log('⚠️  Airdrop failed (possibly rate limited). Try later or use faucet:');
    console.log('   https://faucet.solana.com/\n');
  }
  
  return keypair;
}

/**
 * Gets wallet balance in SOL
 */
export async function getWalletBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance;
}

/**
 * Prints wallet information
 */
export async function printWalletInfo(connection: Connection, keypair: Keypair): Promise<void> {
  const balance = await getWalletBalance(connection, keypair.publicKey);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💼 WALLET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Address: ${keypair.publicKey.toBase58()}`);
  console.log(`   Balance: ${formatSol(balance)} SOL`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
