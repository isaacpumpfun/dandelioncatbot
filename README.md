![DANDELION CAT](./assets/banner.jpg)

# DANDELION CAT

Solana Token Mass Distribution Script

A command-line tool for distributing SPL tokens to randomly generated Solana addresses. Useful for increasing holder count on DEX trackers.

## Features

- 🚀 Batch transactions (up to 10 recipients per TX)
- 🪙 Supports both SPL and Token-2022 tokens
- 📊 Real-time progress bar
- 💰 Cost estimation before execution
- 🔄 Auto-creates test token on devnet for testing

## Requirements

- Node.js 18+
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Create a `script.env` file (or `.env`) with the following:

```env
# Network: devnet | mainnet-beta
NETWORK=devnet

# RPC Endpoint
# For devnet: https://api.devnet.solana.com
# For mainnet: get from helius.dev or quicknode.com
RPC_URL=https://api.devnet.solana.com

# Wallet private key (base58 format)
PRIVATE_KEY=your_private_key_here

# Distribution parameters
TOTAL_RECIPIENTS=5000
TOKENS_PER_RECIPIENT=0.8
RECIPIENTS_PER_TX=10
```

## Usage

### Development (devnet)

```bash
npm run dev
```

### Production (mainnet)

```bash
npm run build
npm run start
```

## How It Works

1. **Loads wallet** from private key in config
2. **Fetches tokens** on the wallet (SPL and Token-2022)
3. **User selects** token and distribution parameters
4. **Estimates cost** (ATA rent + transaction fees)
5. **Generates** random Solana addresses
6. **Executes** batch transactions with:
   - CreateIdempotent (creates ATA for recipient)
   - Transfer (sends tokens)

## Cost Breakdown

For each recipient:
- **ATA Rent**: ~0.00204 SOL (rent-exempt minimum)
- **TX Fee**: ~0.000005 SOL (base fee)
- **Priority Fee**: ~0.00005 SOL (configurable)

**Example for 5,000 recipients:**
- ATA Rent: ~10.2 SOL
- Fees: ~0.03 SOL
- **Total: ~10.23 SOL**

## Limits

- Max recipients per transaction: **10** (transaction size limit)
- Recommended: **8-10** recipients per TX for reliability

## Notes

- Tokens sent to random addresses are **permanently lost** (no one owns the private keys)
- This is intended for artificially increasing holder count on DEX trackers
- Works with both SPL Token Program and Token-2022 Program

## License

MIT

