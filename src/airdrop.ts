import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { TokenInfo } from './tokens';
import { chunkArray, sleep, progressBar, formatSol, formatNumber } from './utils';

export interface AirdropConfig {
  token: TokenInfo;
  recipients: PublicKey[];
  tokensPerRecipient: number;
  recipientsPerTx: number;
}

export interface AirdropResult {
  successful: number;
  failed: number;
  totalSolSpent: number;
  signatures: string[];
  errors: { batch: number; error: string }[];
}

/**
 * Executes mass token distribution
 */
export async function executeAirdrop(
  connection: Connection,
  payer: Keypair,
  config: AirdropConfig
): Promise<AirdropResult> {
  const { token, recipients, tokensPerRecipient, recipientsPerTx } = config;
  
  // Calculate token amount in smallest units
  const amountPerRecipient = BigInt(
    Math.floor(tokensPerRecipient * Math.pow(10, token.decimals))
  );
  
  // Split recipients into batches
  const batches = chunkArray(recipients, recipientsPerTx);
  
  const result: AirdropResult = {
    successful: 0,
    failed: 0,
    totalSolSpent: 0,
    signatures: [],
    errors: [],
  };
  
  const startBalance = await connection.getBalance(payer.publicKey);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 STARTING DISTRIBUTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Token: ${token.mint.toBase58()}`);
  console.log(`   Recipients: ${formatNumber(recipients.length)}`);
  console.log(`   Tokens per address: ${tokensPerRecipient}`);
  console.log(`   Batches: ${batches.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    try {
      const signature = await sendBatchTransaction(
        connection,
        payer,
        token,
        batch,
        amountPerRecipient
      );
      
      result.successful += batch.length;
      result.signatures.push(signature);
      
      // Update progress
      process.stdout.write(`\r   ${progressBar(i + 1, batches.length)}`);
      
      // Small delay between transactions
      if (i < batches.length - 1) {
        await sleep(500);
      }
    } catch (error) {
      result.failed += batch.length;
      result.errors.push({
        batch: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Continue even on error
      process.stdout.write(`\r   ${progressBar(i + 1, batches.length)} ⚠️ Batch ${i + 1} failed`);
    }
  }
  
  const endBalance = await connection.getBalance(payer.publicKey);
  result.totalSolSpent = startBalance - endBalance;
  
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   ✅ Successful: ${formatNumber(result.successful)} addresses`);
  console.log(`   ❌ Failed: ${formatNumber(result.failed)} addresses`);
  console.log(`   💰 Spent: ${formatSol(result.totalSolSpent)} SOL`);
  console.log(`   📝 Transactions: ${result.signatures.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (result.errors.length > 0) {
    console.log('⚠️  Errors:');
    result.errors.slice(0, 5).forEach((err) => {
      console.log(`   Batch ${err.batch}: ${err.error.slice(0, 100)}`);
    });
    if (result.errors.length > 5) {
      console.log(`   ... and ${result.errors.length - 5} more errors`);
    }
    console.log('');
  }
  
  return result;
}

/**
 * Sends a batch transaction for multiple recipients
 */
async function sendBatchTransaction(
  connection: Connection,
  payer: Keypair,
  token: TokenInfo,
  recipients: PublicKey[],
  amountPerRecipient: bigint
): Promise<string> {
  const instructions: TransactionInstruction[] = [];
  
  // Add compute budget to increase limit
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    })
  );
  
  // Priority fee (configurable)
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000, // 0.05 lamports per compute unit
    })
  );
  
  // For each recipient, create ATA and transfer
  for (const recipient of recipients) {
    const recipientAta = getAssociatedTokenAddressSync(
      token.mint,
      recipient,
      false,
      token.programId
    );
    
    // CreateIdempotent - creates ATA if it doesn't exist, otherwise does nothing
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,      // payer
        recipientAta,         // ata
        recipient,            // owner
        token.mint,           // mint
        token.programId       // token program
      )
    );
    
    // Transfer tokens
    instructions.push(
      createTransferInstruction(
        token.tokenAccount,   // source
        recipientAta,         // destination
        payer.publicKey,      // owner
        amountPerRecipient,   // amount
        [],                   // multiSigners
        token.programId       // token program
      )
    );
  }
  
  const transaction = new Transaction().add(...instructions);
  
  // Get fresh blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer.publicKey;
  
  // Send and confirm
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    }
  );
  
  return signature;
}

/**
 * Estimates distribution cost
 */
export function estimateCost(
  totalRecipients: number,
  recipientsPerTx: number
): { ataRent: number; fees: number; total: number } {
  const ATA_RENT = 0.00203928; // SOL per ATA creation
  const TX_FEE = 0.000005;     // base fee
  const PRIORITY_FEE = 0.00005; // approximate priority fee
  
  const numTransactions = Math.ceil(totalRecipients / recipientsPerTx);
  
  const ataRent = totalRecipients * ATA_RENT;
  const fees = numTransactions * (TX_FEE + PRIORITY_FEE);
  
  return {
    ataRent,
    fees,
    total: ataRent + fees,
  };
}
