
"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { useEffect, useState } from "react";
import { createRpc, Rpc, LightSystemProgram, createBN254 } from "@lightprotocol/stateless.js";
import { Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";


// --- Types ---
interface HeliusCompressedAccount {
    hash: string;
    owner: string;
    lamports: number | { words: number[] }; // Can be raw number or BN-like structure
    address?: string;
    data?: { data: number[] } | Uint8Array;
    treeInfo?: {
        tree: string;
        queue: string;
        treeType: string;
        cpiContext?: string;
    };
    leafIndex: number;
    compressedAccount?: any; // Fallback for nested structures sometimes returned
}

// Helper: Hydrate generic API response to strongly typed SDK object
const hydrateAccount = (acc: any, index: number) => {
    try {
        // 1. Hash (Hex String OR Decimal String -> BN)
        // Helius returns hashes as long decimal strings (len > 64) OR hex.
        const rawHash = acc.hash || (acc.compressedAccount ? acc.compressedAccount.hash : null);
        if (!rawHash) throw new Error(`Account ${index} missing hash`);

        const baseStr = rawHash.toString();
        let str = baseStr;
        let base = 10;

        // Improved Heuristic
        if (str.startsWith("0x") || str.startsWith("0X")) {
            str = str.slice(2);
            base = 16;
        } else if (/[a-fA-F]/.test(str)) {
            // Contains Hex characters (and no 0x prefix caught above)
            base = 16;
        } else {
            // Only digits.
            if (str.length === 64) base = 16; // Likely raw hex
            else base = 10; // Likely decimal (short or long)
        }

        const hashBN = new BN(str, base);

        // 2. Owner
        const owner = new PublicKey(acc.owner || acc.compressedAccount.owner);

        // 3. Lamports
        const rawLamports = acc.lamports && acc.lamports.words ? acc.lamports : (acc.lamports || acc.compressedAccount.lamports);
        let lamportsStr = rawLamports.toString();
        let lamportsBase = 10;
        if (lamportsStr.startsWith("0x")) { lamportsStr = lamportsStr.slice(2); lamportsBase = 16; }
        else if (/[a-fA-F]/.test(lamportsStr)) { lamportsBase = 16; }

        const lamports = new BN(lamportsStr, lamportsBase);

        // 4. Merkle Context
        const ti = acc.treeInfo || (acc.compressedAccount ? acc.compressedAccount.treeInfo : null);
        let merkleContext = undefined;
        if (ti) {
            // IMPORTANT: Ensure cpiContext is correctly mapped if present
            merkleContext = {
                tree: new PublicKey(ti.tree),
                queue: new PublicKey(ti.queue),
                treeType: ti.treeType,
                cpiContext: ti.cpiContext ? new PublicKey(ti.cpiContext) : undefined
            };
        }

        return {
            hash: hashBN,
            owner,
            lamports,
            address: acc.address ? Array.from(new PublicKey(acc.address).toBytes()) : null,
            data: acc.data,
            treeInfo: merkleContext,
            leafIndex: acc.leafIndex,
            proveByIndex: false,
            readOnly: false
        };
    } catch (e) {
        console.error(`Failed to hydrate account ${index}`, e);
        throw e;
    }
};

export default function Dashboard() {
    const { connection } = useConnection();
    const { publicKey, connected, signTransaction } = useWallet();
    const [balance, setBalance] = useState<number>(0);
    const [shieldedBalance, setShieldedBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [unshielding, setUnshielding] = useState(false);

    // Fetch Public Balance
    useEffect(() => {
        if (!publicKey) return;
        connection.getBalance(publicKey).then((lamports) => {
            setBalance(lamports / LAMPORTS_PER_SOL);
        });
    }, [publicKey, connection]);

    // Fetch Shielded Balance (Light Protocol)
    useEffect(() => {
        if (!publicKey || !connected) return;

        const fetchShielded = async () => {
            setLoading(true);
            try {
                // We need a Light-enabled RPC.
                // Always use the Helius RPC from env for ZK state, regardless of wallet connection
                const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
                if (!heliusRpc) {
                    console.error("Missing NEXT_PUBLIC_HELIUS_RPC_URL");
                    return;
                }

                // Check if we are on Helius or a capable RPC
                const rpc = createRpc(heliusRpc, heliusRpc);
                // Use ByOwner for Public Keys
                const compressedBalance = await rpc.getCompressedBalanceByOwner(publicKey);

                if (compressedBalance) {
                    // @ts-ignore - BN handling or simple number
                    setShieldedBalance(compressedBalance.toNumber ? compressedBalance.toNumber() / LAMPORTS_PER_SOL : Number(compressedBalance) / LAMPORTS_PER_SOL);
                }
            } catch (e) {
                console.error("Failed to fetch shielded balance:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchShielded();
        // Poll every 10s
        const interval = setInterval(fetchShielded, 10000);
        return () => clearInterval(interval);
        return () => clearInterval(interval);
    }, [publicKey, connected, connection]);

    // Fetch SNS Domain
    const [snsName, setSnsName] = useState<string | null>(null);
    useEffect(() => {
        if (!publicKey || !connected) return;
        const fetchSns = async () => {
            try {
                // Dynamic import to avoid SSR issues with some web3 packages
                const { getAllDomains, performReverseLookup } = await import("@bonfida/spl-name-service");
                // Get all domains owned by the wallet
                const domains = await getAllDomains(connection, publicKey);
                if (domains.length > 0) {
                    // Pick the first one for MVP. Ideally check for "Favorite"
                    const domainKey = domains[0];
                    const name = await performReverseLookup(connection, domainKey);
                    setSnsName(`${name}.sol`);
                }
            } catch (e) {
                console.warn("Failed to fetch SNS domains:", e);
            }
        };
        fetchSns();
    }, [publicKey, connected, connection]);


    const handleUnshield = async () => {
        if (!publicKey || !signTransaction) return;
        setLoading(true);
        try {
            const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
            if (!heliusRpc) {
                alert("Unshielding requires a configured Helius RPC in .env.local");
                return;
            }

            const rpc = createRpc(heliusRpc, heliusRpc);

            // 1. Fetch UTXOs (Shielded Accounts)
            const accounts = await rpc.getCompressedAccountsByOwner(publicKey);
            if (accounts.items.length === 0) {
                alert("No shielded funds found to unshield.");
                return;
            }

            console.log(`Found ${accounts.items.length} shielded accounts. Hydrating...`);

            // 2. Hydrate Accounts
            // @ts-ignore - Light Protocol types can be tricky, trusting our helper
            const inputAccounts = accounts.items.map((acc, i) => hydrateAccount(acc, i));

            // 3. Get Validity Proof
            // @ts-ignore
            const validityProof = await rpc.getValidityProofV0(
                inputAccounts.map((account: any) => ({
                    hash: account.hash,
                    tree: account.treeInfo.tree,
                    queue: account.treeInfo.queue
                })),
                []
            );

            // 4. Calculate Total
            // @ts-ignore
            const totalToUnshield = inputAccounts.reduce((sum, acc) => sum.add(acc.lamports), new BN(0));
            console.log("Total to unshield (lamports):", totalToUnshield.toString());

            // 5. Build Decompress Instruction
            // @ts-ignore
            const instruction = await LightSystemProgram.decompress({
                payer: publicKey,
                inputCompressedAccounts: inputAccounts as any,
                toAddress: publicKey,
                lamports: totalToUnshield,
                recentValidityProof: validityProof.compressedProof,
                recentInputStateRootIndices: validityProof.rootIndices
            });

            // 6. Verify & Fix Transaction Keys (The "Patch")
            // V2 state trees/queues MUST be writable for unshielding (nullifying).
            const requiredWritables = new Set<string>();
            inputAccounts.forEach((acc: any) => {
                if (acc.treeInfo) {
                    requiredWritables.add(acc.treeInfo.tree.toBase58());
                    requiredWritables.add(acc.treeInfo.queue.toBase58());
                }
            });

            console.log("DEBUG: Required Writable Accounts (Dynamic):", Array.from(requiredWritables));

            // Scan instruction keys
            const keys = instruction.keys;
            let patched = false;

            requiredWritables.forEach(req => {
                const keyIndex = keys.findIndex(k => k.pubkey.toBase58() === req);
                if (keyIndex >= 0) {
                    if (!keys[keyIndex].isWritable) {
                        console.warn(`[Fix] Upgrading existing key ${req} to WRITABLE`);
                        keys[keyIndex].isWritable = true;
                        patched = true;
                    }
                } else {
                    console.warn(`[Fix] Appending missing WRITABLE key ${req}`);
                    keys.push({
                        pubkey: new PublicKey(req),
                        isSigner: false,
                        isWritable: true
                    });
                    patched = true;
                }
            });

            if (patched) {
                console.log("Transaction keys were dynamically patched for V2 compatibility.");
            }

            const transaction = new Transaction().add(instruction);
            transaction.feePayer = publicKey;
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            const signed = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signed.serialize());
            console.log("Transaction sent:", signature);

            await connection.confirmTransaction(signature);
            alert(`Unshielded successfully! Tx: ${signature}`);
            setShieldedBalance(0);

        } catch (e: any) {
            console.error("Unshield Error Details:", e);
            if (e.logs) {
                console.error("Simulation Logs:", e.logs);
            }
            alert(`Unshielding failed. See console for logs. Error: ${e.message || e}`);
        } finally {
            setLoading(false);
        }
    };

    // Use the connected wallet as the "username" for the link
    const linkUsername = snsName || (publicKey ? publicKey.toBase58() : "YOUR_WALLET_ADDRESS");

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <header className="flex justify-between items-center mb-10">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                    Stealth Link v2
                </h1>
                <WalletMultiButton />
            </header>

            <main className="max-w-4xl mx-auto space-y-8">
                {!connected ? (
                    <div className="text-center py-20">
                        <h2 className="text-4xl font-bold mb-4">Privacy for your SOL Donations.</h2>
                        <p className="text-gray-400 mb-8">Connect your wallet to manage your shielded funds.</p>
                        <div className="flex justify-center"><WalletMultiButton /></div>
                    </div>
                ) : (
                    <>
                        {/* Stats Card */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                                <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Public Balance</h3>
                                <p className="text-3xl font-bold mt-2">{balance.toFixed(4)} SOL</p>
                                <p className="text-xs text-gray-500 mt-2">Visible to everyone on standard explorers.</p>
                            </div>

                            <div className="p-6 bg-gray-800 rounded-xl border border-purple-500/30 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-purple-600/10 group-hover:bg-purple-600/20 transition-all"></div>
                                <h3 className="text-purple-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                                    Shielded Balance
                                    {loading && <span className="text-xs animate-pulse">Wait...</span>}
                                </h3>
                                <p className="text-3xl font-bold mt-2 text-white">{shieldedBalance.toFixed(4)} SOL</p>
                                <p className="text-xs text-gray-400 mt-2">Private. Only visible to you.</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                            <h3 className="text-xl font-bold mb-4">Your Stealth Link</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 bg-black/50 p-4 rounded-lg font-mono text-sm break-all w-full border border-gray-600">
                                    https://dial.to/?action=solana-action:{typeof window !== 'undefined' ? window.location.origin : ''}/api/actions/donate/{linkUsername}?v=2
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(`https://dial.to/?action=solana-action:${window.location.origin}/api/actions/donate/${linkUsername}?v=2`) }}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-4 rounded-lg font-bold transition-all w-full md:w-auto"
                                >
                                    Copy Link
                                </button>
                            </div>
                            <p className="mt-4 text-sm text-gray-400">
                                Share this link on Twitter/X. Donors will send SOL that automatically gets shielded into your private balance.
                            </p>
                        </div>

                        {/* Unshield Section */}
                        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                🔓 Unshield Funds
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Withdraw your shielded SOL back to your public wallet (or a new address) to spend it.
                            </p>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleUnshield}
                                    disabled={loading || shieldedBalance <= 0}
                                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition-all border border-gray-600"
                                >
                                    {loading ? "Processing..." : "Unshield All to Public Wallet"}
                                </button>
                                {shieldedBalance > 0 && (
                                    <span className="text-xs text-green-400">Available: {shieldedBalance.toFixed(4)} SOL</span>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
