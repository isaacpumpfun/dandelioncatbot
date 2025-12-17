import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Generates a random valid Solana address
 * Creates a keypair and returns only the public key
 * (private key is discarded - address is "unowned")
 */
export function generateRandomAddress(): PublicKey {
  const keypair = Keypair.generate();
  return keypair.publicKey;
}

/**
 * Generates an array of random addresses
 */
export function generateRandomAddresses(count: number): PublicKey[] {
  const addresses: PublicKey[] = [];
  for (let i = 0; i < count; i++) {
    addresses.push(generateRandomAddress());
  }
  return addresses;
}

/**
 * Splits an array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Formats a number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Delay in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats SOL with 6 decimal places
 */
export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(6);
}

/**
 * Creates a progress bar
 */
export function progressBar(current: number, total: number, width: number = 30): string {
  const percent = current / total;
  const filled = Math.round(width * percent);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percentText = (percent * 100).toFixed(1).padStart(5);
  return `[${bar}] ${percentText}% (${current}/${total})`;
}
