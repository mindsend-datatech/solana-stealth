
"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { useEffect, useState, useCallback } from "react";
import { createRpc, Rpc, LightSystemProgram, createBN254 } from "@lightprotocol/stateless.js";
import { Buffer } from "buffer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Copy, ArrowRight, Wallet, Eye, EyeOff, RefreshCw, AlertTriangle, Clock, ExternalLink, Loader2 } from "lucide-react";


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

// RPC Error Types
interface RpcError {
    type: 'rate_limited' | 'unavailable' | 'network' | 'unknown';
    message: string;
    retryable: boolean;
}

// Helper: Parse RPC errors into friendly messages
const parseRpcError = (error: any): RpcError => {
    const message = error?.message || error?.toString() || 'Unknown error';

    if (message.includes('429') || message.includes('rate limit') || message.includes('Too Many Requests')) {
        return {
            type: 'rate_limited',
            message: 'The system is currently busy. Please wait a moment and try again.',
            retryable: true
        };
    }

    if (message.includes('503') || message.includes('unavailable') || message.includes('ECONNREFUSED')) {
        return {
            type: 'unavailable',
            message: 'The privacy service is temporarily unavailable. Please try again in a few minutes.',
            retryable: true
        };
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('ETIMEDOUT')) {
        return {
            type: 'network',
            message: 'Network connection issue. Please check your internet connection and try again.',
            retryable: true
        };
    }

    return {
        type: 'unknown',
        message: message,
        retryable: false
    };
};

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
            const treeAddress = ti.tree.toString ? ti.tree.toString() : ti.tree;
            // Trust the treeType from the RPC - the address name (smt2 vs smt1)
            // is just part of the pubkey, not an indication of tree version!
            const treeType = ti.treeType;

            console.log(`[Hydrate] Tree: ${treeAddress}, treeType: ${treeType}`);

            merkleContext = {
                tree: new PublicKey(ti.tree),
                queue: new PublicKey(ti.queue),
                treeType: treeType,
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
    const { publicKey, connected, signTransaction, sendTransaction } = useWallet();
    const [balance, setBalance] = useState<number>(0);
    const [shieldedBalance, setShieldedBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [unshieldLoading, setUnshieldLoading] = useState(false);

    // New: Destination address for unshielding
    const [destinationAddress, setDestinationAddress] = useState<string>("");
    const [useCustomDestination, setUseCustomDestination] = useState(false);
    const [destinationError, setDestinationError] = useState<string | null>(null);

    // RPC status tracking
    const [rpcError, setRpcError] = useState<RpcError | null>(null);
    const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

    // Validate destination address
    const validateDestination = useCallback((address: string): boolean => {
        if (!address.trim()) {
            setDestinationError(null);
            return true; // Empty is valid (will use connected wallet)
        }
        try {
            new PublicKey(address.trim());
            setDestinationError(null);
            return true;
        } catch {
            setDestinationError("Invalid Solana address");
            return false;
        }
    }, []);

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
            setRpcError(null);
            try {
                // We need a Light-enabled RPC.
                // Always use the Helius RPC from env for ZK state, regardless of wallet connection
                const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
                if (!heliusRpc) {
                    console.error("Missing NEXT_PUBLIC_HELIUS_RPC_URL");
                    setRpcError({
                        type: 'unavailable',
                        message: 'Privacy service is not configured. Please contact support.',
                        retryable: false
                    });
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
                setLastFetchTime(new Date());
            } catch (e) {
                console.error("Failed to fetch shielded balance:", e);
                const parsedError = parseRpcError(e);
                setRpcError(parsedError);
            } finally {
                setLoading(false);
            }
        };

        fetchShielded();
        // Poll every 10s
        const interval = setInterval(fetchShielded, 10000);
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

        // Validate custom destination if enabled
        if (useCustomDestination && destinationAddress.trim()) {
            if (!validateDestination(destinationAddress)) {
                return;
            }
        }

        setUnshieldLoading(true);
        setRpcError(null);

        try {
            const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
            if (!heliusRpc) {
                setRpcError({
                    type: 'unavailable',
                    message: 'Privacy service is not configured. Please contact support.',
                    retryable: false
                });
                return;
            }

            const rpc = createRpc(heliusRpc, heliusRpc);

            // 1. Fetch UTXOs (Shielded Accounts)
            console.log("[Unshield] Step 1: Fetching compressed accounts...");
            const accounts = await rpc.getCompressedAccountsByOwner(publicKey);
            if (accounts.items.length === 0) {
                alert("No shielded funds found to unshield.");
                return;
            }

            console.log(`[Unshield] Found ${accounts.items.length} shielded accounts.`);
            console.log("[Unshield] Raw accounts:", JSON.stringify(accounts.items, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
                , 2));

            // Note: The tree address smt2rJAFdyJJupwMKAqTNAJwvjhmiZ4JYGZmbVRw1Ho 
            // is actually a V1 tree (treeType: 1) - the "2" in the name is just 
            // part of the address, not an indication of tree version!
            // Filter by actual treeType if needed, not by address.
            const validAccounts = accounts.items.filter((acc: any) => {
                const treeType = acc.treeInfo?.treeType;
                // treeType 1 = StateV1, treeType 2 = StateV2, treeType 3 = BatchedAddress
                // V2 trees (treeType 3) have decompression issues
                const isV2 = treeType === 3;
                if (isV2) {
                    console.log(`[Unshield] Filtering out V2 tree account with treeType ${treeType}`);
                }
                return !isV2;
            });

            console.log(`[Unshield] Found ${validAccounts.length} valid accounts (${accounts.items.length - validAccounts.length} V2 accounts filtered out)`);

            if (validAccounts.length === 0) {
                alert("No unshieldable funds found. Your shielded funds may be in a V2 tree which is not yet fully supported.");
                return;
            }

            // 2. Hydrate accounts
            const inputAccounts = validAccounts.map((acc: any, i: number) => {
                const hydrated = hydrateAccount(acc, i);
                console.log(`[Unshield] Hydrated account ${i}:`, {
                    hash: hydrated.hash.toString(),
                    lamports: hydrated.lamports.toString(),
                    tree: hydrated.treeInfo?.tree?.toBase58(),
                    queue: hydrated.treeInfo?.queue?.toBase58(),
                    treeType: hydrated.treeInfo?.treeType
                });
                return hydrated;
            });

            // 3. Get Validity Proof
            console.log("[Unshield] Step 3: Getting validity proof...");
            const proofInputs = inputAccounts.map((account: any) => ({
                hash: account.hash,
                tree: account.treeInfo.tree,
                queue: account.treeInfo.queue
            }));
            console.log("[Unshield] Proof inputs:", proofInputs.map((p: any) => ({
                hash: p.hash.toString(),
                tree: p.tree.toBase58(),
                queue: p.queue.toBase58()
            })));

            // @ts-ignore
            const validityProof = await rpc.getValidityProofV0(proofInputs, []);
            console.log("[Unshield] Validity proof received:", {
                rootIndices: validityProof.rootIndices
            });

            // 4. Calculate Total
            const totalToUnshield = inputAccounts.reduce(
                (sum: any, acc: any) => sum.add(acc.lamports),
                new BN(0)
            );
            console.log("[Unshield] Total to unshield (lamports):", totalToUnshield.toString());

            // 5. Determine destination address
            let toAddress: PublicKey;
            if (useCustomDestination && destinationAddress.trim()) {
                toAddress = new PublicKey(destinationAddress.trim());
            } else {
                toAddress = publicKey;
            }
            console.log("[Unshield] Destination:", toAddress.toBase58());

            // 6. Build Decompress Instruction
            console.log("[Unshield] Step 6: Building decompress instruction...");
            // @ts-ignore
            const instruction = await LightSystemProgram.decompress({
                payer: publicKey,
                inputCompressedAccounts: inputAccounts as any,
                toAddress: toAddress,
                lamports: totalToUnshield,
                recentValidityProof: validityProof.compressedProof,
                recentInputStateRootIndices: validityProof.rootIndices
            });

            // 7. Debug: Log instruction keys for diagnostics
            console.log("[Unshield] Instruction Keys (before patch):");
            instruction.keys.forEach((k: any, i: number) => {
                console.log(`  [${i}] ${k.pubkey.toBase58()} - signer: ${k.isSigner}, writable: ${k.isWritable}`);
            });

            // 8. CRITICAL: Patch instruction keys to mark tree/queue accounts as writable
            // The Light Protocol SDK doesn't properly mark all accounts as writable,
            // causing "Cross-program invocation with unauthorized signer or writable account" error
            const SYSTEM_PROGRAM_IDS = [
                "11111111111111111111111111111111",           // System Program
                "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV", // Noop Program
                "compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq", // Compression Program
                "HwXnGK3tPkkVY6P439H2p68AxpeuWXd5PcrAxFpbmfbA", // Account Compression
                "35hkDgaAKwMCaxRz2ocSZ6NaUrtKkyNqU6c4RV3tYJRh", // Light System Program
            ];

            instruction.keys = instruction.keys.map((key: any) => {
                const pubkeyStr = key.pubkey.toBase58();
                // Mark non-signer, non-system-program accounts as writable
                // This includes state tree, queue, and CPI context accounts
                if (!key.isSigner && !SYSTEM_PROGRAM_IDS.includes(pubkeyStr)) {
                    return { ...key, isWritable: true };
                }
                return key;
            });

            console.log("[Unshield] Instruction Keys (after patch):");
            instruction.keys.forEach((k: any, i: number) => {
                console.log(`  [${i}] ${k.pubkey.toBase58()} - signer: ${k.isSigner}, writable: ${k.isWritable}`);
            });

            // 9. Build compute budget instructions
            const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
                units: 400000, // Increase compute units
            });
            const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 5000, // Add priority fee
            });

            // 10. Get blockhash for versioned transaction
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

            // 11. Build VersionedTransaction (properly respects writable flags)
            // The legacy Transaction class can incorrectly mark accounts as readonly
            const allInstructions = [computeUnitLimit, computeUnitPrice, instruction];

            const messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: blockhash,
                instructions: allInstructions,
            }).compileToV0Message();

            const versionedTx = new VersionedTransaction(messageV0);

            console.log("[Unshield] Step 11: Signing versioned transaction...");
            console.log("[Unshield] Transaction has", allInstructions.length, "instruction(s)");
            console.log("[Unshield] Fee payer:", publicKey.toBase58());
            console.log("[Unshield] Blockhash:", blockhash);

            // Debug: Log message account keys and their writable status
            console.log("[Unshield] Message static account keys:");
            messageV0.staticAccountKeys.forEach((key, i) => {
                const isWritable = messageV0.isAccountWritable(i);
                const isSigner = messageV0.isAccountSigner(i);
                console.log(`  [${i}] ${key.toBase58()} - signer: ${isSigner}, writable: ${isWritable}`);
            });

            if (!signTransaction) {
                throw new Error("Wallet does not support signTransaction");
            }

            let signed;
            try {
                // signTransaction should handle VersionedTransaction
                signed = await signTransaction(versionedTx as any);
                console.log("[Unshield] Transaction signed successfully");
            } catch (signError: any) {
                console.error("[Unshield] Signing failed:", signError);
                throw new Error(`Wallet signing failed: ${signError.message || signError}`);
            }

            console.log("[Unshield] Step 12: Sending transaction (with skipPreflight=true)...");
            const signature = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: true,
                preflightCommitment: 'confirmed',
                maxRetries: 3
            });
            console.log("[Unshield] Transaction sent:", signature);

            console.log("[Unshield] Step 13: Confirming transaction...");
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            });

            const destLabel = useCustomDestination && destinationAddress.trim()
                ? `${destinationAddress.slice(0, 4)}...${destinationAddress.slice(-4)}`
                : "your wallet";
            alert(`Unshielded successfully to ${destLabel}! Tx: ${signature}`);
            setShieldedBalance(0);
            setDestinationAddress("");
            setUseCustomDestination(false);

        } catch (e: any) {
            console.error("[Unshield] ERROR:", e);

            // Try to extract more details
            if (e.logs) {
                console.error("[Unshield] Simulation Logs:");
                e.logs.forEach((log: string, i: number) => console.error(`  [${i}] ${log}`));
            }

            if (e.message) {
                console.error("[Unshield] Error message:", e.message);
            }

            // Check for V2 tree limitation
            if (e.message && e.message.includes("V2 trees are not supported")) {
                alert(
                    "Your shielded funds are stored in a V2 state tree which is not yet fully supported by the Light Protocol SDK. " +
                    "This is a known limitation. Please try again later or contact Light Protocol for updates on V2 support."
                );
                return;
            }

            // Check for error 20005 (InvalidMerkleProof)
            if (e.message && e.message.includes("20005")) {
                alert(
                    "Transaction failed with an invalid Merkle proof error (20005). " +
                    "This may be due to V2 tree compatibility issues. Please try again or contact support."
                );
                return;
            }

            const parsedError = parseRpcError(e);
            if (parsedError.type !== 'unknown') {
                setRpcError(parsedError);
            } else {
                alert(`Unshielding failed. See console for logs. Error: ${e.message || e}`);
            }
        } finally {
            setUnshieldLoading(false);
        }
    };

    // Use the connected wallet as the "username" for the link
    const linkUsername = snsName || (publicKey ? publicKey.toBase58() : "YOUR_WALLET_ADDRESS");

    // Manual retry function
    const retryFetch = () => {
        if (!publicKey || !connected) return;
        setRpcError(null);
        // Trigger re-fetch by updating a dependency
        setLoading(true);
        const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
        if (!heliusRpc) return;

        const rpc = createRpc(heliusRpc, heliusRpc);
        rpc.getCompressedBalanceByOwner(publicKey)
            .then((compressedBalance) => {
                if (compressedBalance) {
                    // @ts-ignore
                    setShieldedBalance(compressedBalance.toNumber ? compressedBalance.toNumber() / LAMPORTS_PER_SOL : Number(compressedBalance) / LAMPORTS_PER_SOL);
                }
                setLastFetchTime(new Date());
            })
            .catch((e) => {
                const parsedError = parseRpcError(e);
                setRpcError(parsedError);
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 cyber-grid opacity-30" />
            <div className="absolute inset-0 cyber-radial" />

            <div className="relative max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <header className="flex justify-between items-center mb-10">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 group-hover:opacity-80 transition-opacity">
                            Stealth Link
                        </span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/register">
                            <Button variant="ghost" size="sm">Register Handle</Button>
                        </Link>
                        <WalletMultiButton />
                    </div>
                </header>

                <main className="space-y-6">
                    {!connected ? (
                        <div className="text-center py-20">
                            <Card variant="glass" className="max-w-md mx-auto">
                                <CardContent className="py-12 space-y-6">
                                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                                        <Wallet className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold mb-2">Privacy for your SOL Donations</h2>
                                        <p className="text-gray-400">Connect your wallet to manage your shielded funds.</p>
                                    </div>
                                    <WalletMultiButton />
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <>
                            {/* RPC Error Alert */}
                            {rpcError && (
                                <Card variant={rpcError.type === 'rate_limited' ? 'glass' : 'terminal'}
                                    className={`border ${rpcError.type === 'rate_limited' ? 'border-yellow-500/50' : 'border-red-500/50'}`}>
                                    <CardContent className="py-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {rpcError.type === 'rate_limited' ? (
                                                    <Clock className="w-5 h-5 text-yellow-400" />
                                                ) : (
                                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                                )}
                                                <div>
                                                    <div className={`font-medium ${rpcError.type === 'rate_limited' ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        System Status
                                                    </div>
                                                    <div className="text-sm text-gray-400">{rpcError.message}</div>
                                                </div>
                                            </div>
                                            {rpcError.retryable && (
                                                <Button variant="secondary" size="sm" onClick={retryFetch} disabled={loading}>
                                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                                    {loading ? 'Retrying...' : 'Retry'}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card variant="glass">
                                    <CardContent className="py-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                                                <Eye className="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Public Balance</h3>
                                            </div>
                                        </div>
                                        <p className="text-4xl font-bold font-mono">{balance.toFixed(4)} <span className="text-lg text-gray-500">SOL</span></p>
                                        <p className="text-xs text-gray-500 mt-2">Visible on standard explorers</p>
                                    </CardContent>
                                </Card>

                                <Card variant="glow" className="relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-purple-600/5 group-hover:bg-purple-600/10 transition-all" />
                                    <CardContent className="py-6 relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-900/50 flex items-center justify-center">
                                                    <EyeOff className="w-5 h-5 text-purple-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-purple-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                                                        Shielded Balance
                                                        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                                    </h3>
                                                </div>
                                            </div>
                                            <Badge variant="purple" className="gap-1">
                                                <Shield className="w-3 h-3" />
                                                Private
                                            </Badge>
                                        </div>
                                        <p className="text-4xl font-bold font-mono text-white">{shieldedBalance.toFixed(4)} <span className="text-lg text-gray-500">SOL</span></p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Only visible to you
                                            {lastFetchTime && (
                                                <span className="ml-2 text-gray-500">
                                                    • Synced: {lastFetchTime.toLocaleTimeString()}
                                                </span>
                                            )}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Stealth Link */}
                            <Card variant="glass">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ExternalLink className="w-5 h-5 text-purple-400" />
                                        Your Stealth Link
                                    </CardTitle>
                                    <CardDescription>
                                        Share on Twitter/X. Donors send SOL that automatically gets shielded.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1 bg-black/50 p-4 rounded-lg font-mono text-sm break-all border border-gray-800 text-cyan-400">
                                            https://dial.to/?action=solana-action:{typeof window !== 'undefined' ? window.location.origin : ''}/api/actions/donate/{linkUsername}?v=2
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={() => { navigator.clipboard.writeText(`https://dial.to/?action=solana-action:${window.location.origin}/api/actions/donate/${linkUsername}?v=2`) }}
                                            className="gap-2 md:w-auto w-full"
                                        >
                                            <Copy className="w-4 h-4" />
                                            Copy Link
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Unshield Section */}
                            <Card variant="glass">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-purple-400" />
                                        Unshield Funds
                                    </CardTitle>
                                    <CardDescription>
                                        Withdraw shielded SOL to a public wallet. For maximum privacy, use a fresh address.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Destination Toggle */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant={!useCustomDestination ? "default" : "secondary"}
                                                size="sm"
                                                onClick={() => {
                                                    setUseCustomDestination(false);
                                                    setDestinationError(null);
                                                }}
                                            >
                                                <Wallet className="w-4 h-4" />
                                                My Wallet
                                            </Button>
                                            <Button
                                                variant={useCustomDestination ? "default" : "secondary"}
                                                size="sm"
                                                onClick={() => setUseCustomDestination(true)}
                                            >
                                                <Shield className="w-4 h-4" />
                                                Fresh Wallet
                                            </Button>
                                        </div>

                                        {/* Custom Destination Input */}
                                        {useCustomDestination && (
                                            <div className="space-y-2">
                                                <label className="text-sm text-gray-400">
                                                    Destination Address (breaks the link to your main wallet)
                                                </label>
                                                <Input
                                                    variant="terminal"
                                                    value={destinationAddress}
                                                    onChange={(e) => {
                                                        setDestinationAddress(e.target.value);
                                                        validateDestination(e.target.value);
                                                    }}
                                                    placeholder="Enter Solana address..."
                                                />
                                                {destinationError && (
                                                    <p className="text-red-400 text-xs flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {destinationError}
                                                    </p>
                                                )}
                                                <p className="text-xs text-green-400/70 flex items-center gap-1">
                                                    <Shield className="w-3 h-3" />
                                                    Tip: Use a fresh exchange deposit address or new wallet for maximum privacy.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <Button
                                            onClick={handleUnshield}
                                            disabled={unshieldLoading || shieldedBalance <= 0 || (useCustomDestination && !!destinationError)}
                                            className="gap-2"
                                        >
                                            {unshieldLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <Shield className="w-4 h-4" />
                                                    Unshield {shieldedBalance.toFixed(4)} SOL
                                                </>
                                            )}
                                        </Button>
                                        {shieldedBalance > 0 && (
                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                <ArrowRight className="w-3 h-3" />
                                                {useCustomDestination && destinationAddress.trim()
                                                    ? `${destinationAddress.slice(0, 8)}...${destinationAddress.slice(-8)}`
                                                    : 'Your connected wallet'}
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Register Handle CTA */}
                            <Card variant="glow" className="border-purple-500/30">
                                <CardContent className="py-6">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold">Get a memorable .stealth handle</h3>
                                            <p className="text-sm text-gray-400">
                                                Register a handle like <span className="text-purple-400 font-mono">yourname.stealth</span> for easier sharing.
                                            </p>
                                        </div>
                                        <Link href="/register">
                                            <Button variant="secondary" className="gap-2 whitespace-nowrap">
                                                Register Now
                                                <ArrowRight className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
