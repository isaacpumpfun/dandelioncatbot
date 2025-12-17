import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';

export interface TokenInfo {
  mint: PublicKey;
  tokenAccount: PublicKey;
  balance: bigint;
  decimals: number;
  displayBalance: number;
  programId: PublicKey;
  symbol?: string;
}

/**
 * Gets all tokens on the wallet (SPL and Token-2022)
 */
export async function getWalletTokens(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenInfo[]> {
  const tokens: TokenInfo[] = [];
  
  // Get tokens of both standards
  const [splAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);
  
  const allAccounts = [
    ...splAccounts.value.map(a => ({ ...a, programId: TOKEN_PROGRAM_ID })),
    ...token2022Accounts.value.map(a => ({ ...a, programId: TOKEN_2022_PROGRAM_ID })),
  ];
  
  for (const account of allAccounts) {
    const parsed = account.account.data.parsed;
    const info = parsed.info;
    
    const balance = BigInt(info.tokenAmount.amount);
    const decimals = info.tokenAmount.decimals;
    
    // Skip tokens with zero balance
    if (balance === 0n) continue;
    
    tokens.push({
      mint: new PublicKey(info.mint),
      tokenAccount: account.pubkey,
      balance,
      decimals,
      displayBalance: Number(balance) / Math.pow(10, decimals),
      programId: account.programId,
    });
  }
  
  // Sort by balance (highest first)
  tokens.sort((a, b) => Number(b.balance - a.balance));
  
  return tokens;
}

/**
 * Formats token list for console output
 */
export function formatTokenList(tokens: TokenInfo[]): string {
  if (tokens.length === 0) {
    return '  No tokens found on this wallet\n';
  }
  
  let output = '';
  
  tokens.forEach((token, index) => {
    const programLabel = token.programId.equals(TOKEN_2022_PROGRAM_ID) ? '[T22]' : '[SPL]';
    const mintShort = token.mint.toBase58().slice(0, 8) + '...' + token.mint.toBase58().slice(-4);
    
    output += `  [${index + 1}] ${programLabel} ${mintShort}\n`;
    output += `      Balance: ${token.displayBalance.toLocaleString('en-US')} tokens\n`;
    output += `      Mint: ${token.mint.toBase58()}\n`;
    output += '\n';
  });
  
  return output;
}

/**
 * Checks if there are enough tokens for distribution
 */
export function checkSufficientBalance(
  token: TokenInfo,
  totalRecipients: number,
  tokensPerRecipient: number
): { sufficient: boolean; required: number; available: number } {
  const required = totalRecipients * tokensPerRecipient;
  const available = token.displayBalance;
  
  return {
    sufficient: available >= required,
    required,
    available,
  };
}

/**
 * Creates a test SPL token and mints to wallet (devnet only)
 */
export async function createTestToken(
  connection: Connection,
  payer: Keypair,
  mintAmount: number = 10_000_000
): Promise<TokenInfo> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🪙 CREATING TEST TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const decimals = 6;
  
  // Create mint
  console.log('   ⏳ Creating token...');
  const mint = await createMint(
    connection,
    payer,           // payer
    payer.publicKey, // mint authority
    null,            // freeze authority (null = none)
    decimals,        // decimals
    undefined,       // keypair (auto-generate)
    undefined,       // confirm options
    TOKEN_PROGRAM_ID // program id
  );
  console.log(`   ✅ Mint created: ${mint.toBase58()}`);
  
  // Create token account for our wallet
  console.log('   ⏳ Creating token account...');
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log(`   ✅ Token account: ${tokenAccount.address.toBase58()}`);
  
  // Mint tokens
  const mintAmountRaw = BigInt(mintAmount) * BigInt(10 ** decimals);
  console.log(`   ⏳ Minting ${mintAmount.toLocaleString('en-US')} tokens...`);
  
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer,           // mint authority
    mintAmountRaw
  );
  console.log(`   ✅ Minted: ${mintAmount.toLocaleString('en-US')} TEST`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return {
    mint,
    tokenAccount: tokenAccount.address,
    balance: mintAmountRaw,
    decimals,
    displayBalance: mintAmount,
    programId: TOKEN_PROGRAM_ID,
    symbol: 'TEST',
  };
}
