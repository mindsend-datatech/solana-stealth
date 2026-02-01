# Stealth Link

**Privacy-First Donations on Solana**

[![Built with Solana Blinks](https://img.shields.io/badge/Built_with-Solana_Blinks-9945FF?style=for-the-badge&logo=solana)](https://docs.dialect.to/documentation/actions-and-blinks)
[![Powered by Light Protocol](https://img.shields.io/badge/Privacy_by-Light_Protocol-000000?style=for-the-badge)](https://lightprotocol.com)
[![Indexed by Helius](https://img.shields.io/badge/Indexed_by-Helius-E84125?style=for-the-badge)](https://helius.dev)

Stealth Link enables creators, developers, and privacy-conscious users to receive SOL donations publicly on Twitter/X without revealing their wallet balance or transaction history. It bridges the viral distribution of **Solana Blinks** with the ZK-privacy of **Light Protocol**.

---

## The Problem

In the Web3 creator economy, accepting public donations means doxxing your wallet.

- **Public Donations**: Put your SOL address in your bio and everyone sees your balance, trade history, and net worth
- **The "Anon" Dilemma**: Privacy-focused users can't accept tips because it links their persona to their financial identity
- **Existing Tools**: Current solutions (Blink generators, tip jars) offer zero on-chain privacy

## The Solution

A Stealth Link (e.g., `stealth.link/donate/ariel.stealth`) unfurls as a native Blink on Twitter/X. When a supporter donates:

1. **Frontend**: The Blink constructs a transaction using Light Protocol
2. **On-Chain**: SOL is **shielded** (compressed) into a private UTXO owned by the creator
3. **Result**: Explorer shows `Donor → Light Protocol Pool`. The creator's personal wallet never receives a public transfer

The creator manages funds via a private Dashboard where they can view their shielded balance and **unshield** (withdraw) to any fresh wallet when needed - breaking the on-chain link entirely.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           TWITTER/X                                 │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                     BLINK PREVIEW                           │  │
│   │   ┌──────────┐                                              │  │
│   │   │  🥷 Icon │  Donate to @creator                         │  │
│   │   └──────────┘  Support privately via Stealth Link          │  │
│   │                                                              │  │
│   │   [0.1 SOL]  [0.5 SOL]  [1 SOL]  [Custom]                   │  │
│   └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        STEALTH LINK API                            │
│                                                                     │
│   GET /api/actions/donate/[username]   → Blink metadata            │
│   POST /api/actions/donate/[username]  → Create shield transaction │
│                                                                     │
│   Resolves: .sol domains, .stealth handles, raw pubkeys           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LIGHT PROTOCOL (ZK COMPRESSION)                 │
│                                                                     │
│   LightSystemProgram.compress()                                     │
│   ┌──────────┐    ┌──────────────┐    ┌─────────────────┐          │
│   │  Donor   │───▶│ Light Pool   │───▶│ Shielded UTXO   │          │
│   │  Wallet  │    │   (Public)   │    │ (Private Owner) │          │
│   └──────────┘    └──────────────┘    └─────────────────┘          │
│                                                                     │
│   PUBLIC EXPLORER: "Donor → Light Protocol"                        │
│   ACTUAL STATE: Creator owns compressed SOL                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CREATOR DASHBOARD                             │
│                                                                     │
│   ┌────────────────────────────────────────────────────────┐       │
│   │  Shielded Balance: 2.5 SOL                             │       │
│   │                                                         │       │
│   │  [Unshield to Connected Wallet]                        │       │
│   │  [Unshield to Fresh Address: _____________ ]           │       │
│   └────────────────────────────────────────────────────────┘       │
│                                                                     │
│   LightSystemProgram.decompress() → Any destination wallet         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Shielding (Receiving Donations)

When a donor sends SOL through a Stealth Link:

```typescript
// Blink API constructs this transaction
const ix = await LightSystemProgram.compress({
  payer: donorPubkey,
  toAddress: creatorPubkey,
  lamports: amountLamports,
  outputStateTree: stateTree, // V1 tree for compatibility
});
```

The SOL enters Light Protocol's compression pool. The creator's ownership is recorded as a **compressed account** - invisible on standard explorers.

### Unshielding (Withdrawing Funds)

Creators withdraw from the Dashboard:

```typescript
// Fetch creator's compressed accounts via Helius ZK-RPC
const accounts = await rpc.getCompressedAccountsByOwner(creatorPubkey);

// Decompress to any destination (fresh wallet for max privacy)
const ix = await LightSystemProgram.decompress({
  payer: creatorPubkey,
  toAddress: destinationPubkey, // Can be any wallet
  lamports: totalBalance,
  inputCompressedAccounts: accounts,
});
```

### Handle Registry (.stealth domains)

On-chain Anchor program maps human-readable handles to wallets:

```rust
#[account]
pub struct RegistryEntry {
    pub handle: String,       // "ariel"
    pub authority: Pubkey,    // Wallet owner
    pub bump: u8,
}

// PDA: seeds = ["stealth", handle.as_bytes()]
```

---

## Tech Stack

| Component | Technology | Purpose |
|:----------|:-----------|:--------|
| **Privacy Engine** | [Light Protocol](https://lightprotocol.com) | ZK Compression for shielded SOL transfers |
| **Distribution** | [Solana Blinks](https://docs.dialect.to) | Native Twitter/X integration |
| **Indexing** | [Helius](https://helius.dev) | ZK-enabled RPC for compressed state |
| **Framework** | Next.js 14 | App Router for API + Dashboard |
| **Registry** | Anchor Program | On-chain handle → wallet mapping |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Helius API Key ([Get one here](https://dashboard.helius.dev/))

### Installation

```bash
git clone https://github.com/mindsend-datatech/solana-stealth.git
cd solana-stealth
npm install
```

### Environment Setup

Create `.env.local`:

```bash
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
```

### Run Locally

```bash
npm run dev
```

### Test the Blink

1. Open `http://localhost:3000/api/actions/donate/YOUR_WALLET` to see the Blink JSON
2. Use [dial.to](https://dial.to) to preview how the Blink renders
3. Register a `.stealth` handle at `http://localhost:3000/register`

---

## Key Technical Decisions

### V1 State Tree Selection

Light Protocol has V1 and V2 state trees. We explicitly select V1 trees because:

- V2 trees require additional account permissions during decompression
- V1 provides stable, well-tested behavior for our use case

```typescript
// Only use V1 trees (treeType: 1)
const outputStateTree = stateTrees.find(t => t.treeType === 1);
```

### Unshield to Fresh Wallet

Maximum privacy requires breaking the on-chain link. The Dashboard allows unshielding to any destination:

1. Shield funds arrive at Light Pool → Creator's compressed account
2. Creator unshields to a fresh wallet address (not their main wallet)
3. No on-chain connection between donor, creator identity, and final funds

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed status and plans.

**Completed:**
- [x] Registration page for `.stealth` handles
- [x] Blink API with .sol/.stealth/pubkey resolution
- [x] Dashboard with shielded balance display
- [x] Unshield to connected wallet
- [x] Unshield to fresh wallet (privacy mode)
- [x] RPC error handling with retry

**Planned:**
- [ ] Gas relayer for donor privacy
- [ ] Meta-address support (one-time stealth addresses)
- [ ] SPL token support (USDC, BONK)

---

## License

MIT

---

## Credits

Built with support from:
- [Light Protocol](https://lightprotocol.com) - ZK Compression infrastructure
- [Helius](https://helius.dev) - ZK-enabled RPC indexing
- [Dialect](https://dialect.to) - Blink specification and tooling
