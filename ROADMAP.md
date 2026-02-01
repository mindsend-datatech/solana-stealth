# Solana Stealth - Product Roadmap

This document outlines the development path for **Solana Stealth**, a privacy-first donation platform combining Solana Actions and Light Protocol.

## ✅ Core MVP (COMPLETED)

The MVP goal is a "complete loop" where a user can register a handle, receive anonymous donations on X (Twitter), and withdraw funds.

### 1. Robust Registry & Identity
- [x] **Deploy Registry to Devnet**: Deployed the `stealth-registry` Anchor program to Solana Devnet at `3yLhEZ1di979tt2SrHsPMwvScYD89rGXmMryRhZwtAM2`.
- [ ] **Deploy Registry to Mainnet**: Deploy the `stealth-registry` Anchor program to Solana Mainnet.
- [x] **Registration UI**: Built `/register` page where users can connect their wallet and mint a `.stealth` handle by calling the `register` instruction.
- [x] **Handle Resolution**: `route.ts` correctly resolves `.stealth` handles to wallet addresses via PDA lookup.

### 2. Shielded Donation Flow (The Blink)
- [x] **Light Protocol Integration**: Use `LightSystemProgram.compress` to shield transfers.
- [x] **Fee Payment Optimization**: Transaction uses minimal fees with proper state tree selection.
- [x] **Blink Metadata Polish**: Professional ninja-themed icon and clear donation CTAs.

### 3. Dashboard & Unshielding
- [x] **Balance Tracking**: Fetch `getCompressedAccountsByOwner` to show "Shielded Balance".
- [x] **Unshielding Logic**: Use `LightSystemProgram.decompress` to withdraw funds.
- [x] **Unshield to Fresh Wallet**: Dashboard includes destination address input allowing users to unshield to any wallet, breaking the link between shielded pool and main wallet.
- [x] **V2 Tree Compatibility**: Fixed privilege escalation issue with Light Protocol's V2 state trees by ensuring all required accounts are marked writable.

### 4. Infrastructure Reliability
- [x] **RPC Fallback**: Implemented error handling with friendly "System Busy" messages when Helius ZK-RPC is rate-limited or unavailable. Includes retry functionality.

---

## Nice-to-Haves (Post-MVP Enhancements)

These features enhance privacy, usability, and scale but are not blockers for the initial Hackathon submission.

### 5. Enhanced Privacy (The "Relayer")
*Problem*: Currently, the **Donor** pays the gas fee, meaning the donor's address is linked to the interaction with the Light Protocol pool.
*Solution*: **Gas Relayer**.
- [ ] Create a centralized "Relayer" API.
- [ ] Donor signs a message ("I want to donate 1 SOL to Ariel").
- [ ] Relayer submits the transaction and pays the gas.
- [ ] *Benefit*: Donor's connection to the privacy protocol is obfuscated.

### 6. Meta-Address Support
*Problem*: The registry maps `handle` -> `wallet`. If the Registry is public, everyone knows `ariel` = `Wallet A`.
*Solution*: **Stealth Meta-Addresses**.
- [ ] Upgrade Registry to store two keys: `scanning_key` (public) and `spending_key` (private/commit).
- [ ] Donor derives a one-time stealth address for *each* donation using the scanning key.
- [ ] *Benefit*: Even looking at the registry doesn't reveal the recipient's main wallet.

### 7. Token Support (SPL)
- [ ] Support shielding **USDC**, **BONK**, and other SPL tokens.
- [ ] Update Light Protocol SDK usage to `LightSystemProgram.compressToken`.
- [ ] Add specific Action buttons: "Donate 10 USDC".

### 8. Analytics & Social
- [ ] **Leaderboard**: Show "Most Donated To" (by volume of shielded txs) without revealing amounts (using ZK proofs of rank? or just rough volume estimates).
- [ ] **Notifications**: A Telegram/Discord bot that alerts you: "You received a Shielded Donation! (Amount hidden)."

---

## Testing & Verification Plan

### Test 1: The "Happy Path" (End-to-End) ✅ VERIFIED
1.  **Register**: User A registers `testuser.stealth` on the new Registration UI.
2.  **Share**: User A tweets `https://stealth.link/api/actions/donate/testuser.stealth`.
3.  **Donate**: User B (Donor) clicks the Blink, sends 0.1 SOL.
4.  **Verification (Public)**: Check Solscan. User B sent SOL to `Light Protocol`. User A's wallet shows **0 change**.
5.  **Verification (Private)**: User A logs into Dashboard. Sees "Shielded Balance: 0.1 SOL".
6.  **Unshield**: User A clicks "Unshield". Funds arrive in User A's wallet (or nice-to-have: a new fresh wallet).

### Test 2: Edge Cases
- **Invalid Handle**: Verify Blink returns proper "User not found" error.
- **Micro-Donations**: Verify shielding works for very small amounts (dust limits).
- **Concurrent Donations**: Verify multiple donors sending at once doesn't cause state conflicts (Merkle tree concurrency is handled by Light, but verify UI updates).

### Test 3: Recovery ✅ IMPLEMENTED
- **RPC Failure**: Simulate RPC downtime. Ensure UI fails gracefully and doesn't leave the user panic-clicking.

---

## MVP Completion Summary

**All Core Features Implemented and Verified:**

| Feature | Status | Notes |
|---------|--------|-------|
| Registration page (`/register`) | ✅ | Mint `.stealth` handles |
| Dashboard with shielded balance | ✅ | Real-time balance display |
| Blink API for donations | ✅ | Supports .sol, .stealth, and pubkey |
| Unshield to connected wallet | ✅ | Working with V2 trees |
| Unshield to fresh wallet | ✅ | Privacy-preserving withdrawal |
| RPC error handling | ✅ | Friendly messages + retry |
| Landing page | ✅ | "How it Works" + CTAs |

**Technical Stack:**
- Next.js 16 with App Router
- Light Protocol SDK v0.22.0 for ZK compression
- Helius RPC for indexed ZK state
- Anchor program for handle registry (Devnet)
- Tailwind CSS for styling

**Key Technical Fix (V2 Tree Compatibility):**
The Light Protocol SDK's `LightSystemProgram.decompress` instruction doesn't properly mark all required accounts as writable for V2 state trees. We implemented an aggressive patching approach that marks all non-signer, non-system-program accounts as writable before sending the transaction.

**Remaining for Production:**
- [ ] Deploy registry to Mainnet
- [ ] Custom domain setup (stealth.link)
- [ ] Production Helius API key
- [ ] SSL certificate
