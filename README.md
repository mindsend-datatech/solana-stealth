# Stealth Link 🥷🔗
> **The Privacy-First "Link-in-Bio" for Solana.**

[![Built with Solana Blinks](https://img.shields.io/badge/Built_with-Solana_Blinks-9945FF)](https://solana.com/docs/advanced/actions)
[![Powered by Light Protocol](https://img.shields.io/badge/Privacy_by-Light_Protocol-000000)](https://lightprotocol.com)
[![Indexed by Helius](https://img.shields.io/badge/Indexed_by-Helius-orange)](https://helius.dev)

**Stealth Link** allows creators, developers, and anons to receive SOL donations publicly on Twitter/X without revealing their main wallet's balance or transaction history. It bridges the viral distribution of **Solana Blinks** with the ZK-privacy of **Light Protocol**.

---

## 🛑 The Problem
In the Web3 creator economy, "doxxing your wallet" is the cost of doing business.
*   **Public Donations**: If you put your SOL address in your bio, everyone can see your balance, your trade history, and your net worth.
*   **The "Anon" Dilemma**: Privacy-focused users refuse to accept public tips because it links their persona to their financial identity.
*   **Existing Tools (PIP.ME, etc.)**: Are great for UX, but offer **zero on-chain privacy**.

## ✅ The Solution: Stealth Link
A "Stealth Link" (e.g., `stealth.link/u/ariel`) unfurls as a **Solana Blink** on Twitter. When a fan clicks "Donate":
1.  **Frontend**: The Blink constructs a transaction using **Light Protocol**.
2.  **On-Chain**: The SOL is **Shielded** (compressed) into a private UTXO owned by the creator.
3.  **Result**: The public explorer shows `Donor -> Light Protocol Pool`. The creator's personal wallet address never receives a public transfer. The link is broken.

The Creator manages these funds via a private **Dashboard**, where they can view their shielded balance and "Unshield" (withdraw) funds to a fresh exchange address when needed.

---

## 🛠 Tech Stack & Sponsors

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Privacy Engine** | [**Light Protocol**](https://lightprotocol.com) | Uses ZK Compression to shield SOL. We use `@lightprotocol/stateless.js` for `compress` (shield) and `decompress` (unshield) operations. |
| **Distribution** | [**Solana Actions / Blinks**](https://solana.com/solutions/actions) | The donation interface is a Blink (`GET/POST` API) that works directly inside Twitter/X. |
| **Infrastructure** | [**Helius**](https://helius.dev) | **Critical:** Standard RPCs cannot index ZK-compressed state. We rely on Helius ZK-enabled RPCs to fetch validity proofs and compressed balances. |
| **Framework** | [**Next.js 14**](https://nextjs.org) | App Router handles both the Blink API (`/api/actions/...`) and the React Dashboard. |
| **Styling** | [**Tailwind CSS**](https://tailwindcss.com) | For a clean, dark-mode "hacker" aesthetic. |

---

## 🏗 Architecture (Inner Workings)

### 1. The Blink (Data Ingestion)
*   **Endpoint:** `/api/actions/donate/[username]`
*   **Logic:**
    *   **GET**: Returns metadata (Icon, Description, Action Buttons).
    *   **POST**:
        1.  Receives the Donor's Public Key.
        2.  Derives/Lookups the Creator's Shield Address.
        3.  Constructs a `LightSystemProgram.compress` instruction.
        4.  Returns the unsigned transaction to the user.

### 2. The Shielding Process (Light Protocol)
*   The transaction executes on Solana.
*   SOL is deposited into the Light Protocol Program PDAs.
*   A **Compressed UTXO** is created for the Creator.
*   **Privacy**: The on-chain observer sees a transfer to the Light Program, not the Creator.

### 3. The Dashboard (Unshielding)
*   **Connection**: Creator connects via Wallet Adapter.
*   **Sync**: The app queries the Helius RPC using `getCompressedAccountsByOwner`.
*   **Unshield**:
    1.  User clicks "Unshield".
    2.  App fetches a **Validity Proof** (Merkle proof) from Helius.
    3.  App constructs a `LightSystemProgram.decompress` transaction.
    4.  Funds are moved from the Shielded Pool -> Public Wallet.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   **Helius API Key** (Required for Devnet ZK-Compression support).

### Installation

1.  **Clone & Install**
    ```bash
    git clone https://github.com/your-username/solana-stealth.git
    cd solana-stealth
    npm install
    # or
    yarn install
    ```

2.  **Configure Environment**
    Create a `.env.local` file:
    ```bash
    # Get this from https://dashboard.helius.dev/
    NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
    ```

3.  **Run Locally**
    ```bash
    npm run dev
    ```

4.  **Test the Blink**
    *   Go to `http://localhost:3000/api/actions/donate/ariel` to see the JSON.
    *   Use [dial.to](https://dial.to) and paste your local URL (or ngrok tunnel) to test the UI.

---

## 🔮 Future Roadmap
*   **Map Usernames**: Integrate a real database (Postgres) to map `username` -> `wallet`.
*   **Donor Privacy**: Implement a "Relayer" service to hide the donor's address as well (currently, donor pays for gas, so they are visible).
*   **SPL Token Support**: Allow shielding of USDC/BONK.

---

**Hackathon Track**: Signal for Web3 / Infrastructure.
