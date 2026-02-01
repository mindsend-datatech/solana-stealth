"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair, LAMPORTS_PER_SOL, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Terminal, Zap, ExternalLink, ArrowRight, Check, Loader2, AlertTriangle, Wallet, RefreshCw } from "lucide-react";
import { createRpc, LightSystemProgram } from "@lightprotocol/stateless.js";
import BN from "bn.js";
import { Buffer } from "buffer";

// Stealth Registry Program ID (Devnet)
const STEALTH_REGISTRY_PROGRAM_ID = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

// Anchor discriminator for "register" instruction
// sha256("global:register")[0..8] - precomputed
const REGISTER_DISCRIMINATOR = Buffer.from([211, 124, 67, 15, 211, 194, 178, 240]);

// Helper: Hydrate generic API response to strongly typed SDK object (from dashboard)
const hydrateAccount = (acc: any, index: number) => {
    try {
        const rawHash = acc.hash || (acc.compressedAccount ? acc.compressedAccount.hash : null);
        if (!rawHash) throw new Error(`Account ${index} missing hash`);
        const baseStr = rawHash.toString();
        let str = baseStr;
        let base = 10;
        if (str.startsWith("0x") || str.startsWith("0X")) { str = str.slice(2); base = 16; }
        else if (/[a-fA-F]/.test(str)) base = 16;
        else if (str.length === 64) base = 16;
        const hashBN = new BN(str, base);
        const owner = new PublicKey(acc.owner || acc.compressedAccount.owner);
        const rawLamports = acc.lamports && acc.lamports.words ? acc.lamports : (acc.lamports || acc.compressedAccount.lamports);
        let lamportsStr = rawLamports.toString();
        let lamportsBase = 10;
        if (lamportsStr.startsWith("0x")) { lamportsStr = lamportsStr.slice(2); lamportsBase = 16; }
        else if (/[a-fA-F]/.test(lamportsStr)) lamportsBase = 16;
        const lamports = new BN(lamportsStr, lamportsBase);
        const ti = acc.treeInfo || (acc.compressedAccount ? acc.compressedAccount.treeInfo : null);
        let merkleContext = undefined;
        if (ti) {
            merkleContext = {
                tree: new PublicKey(ti.tree),
                queue: new PublicKey(ti.queue),
                treeType: ti.treeType,
                cpiContext: ti.cpiContext ? new PublicKey(ti.cpiContext) : undefined
            };
        }
        return { hash: hashBN, owner, lamports, address: acc.address ? Array.from(new PublicKey(acc.address).toBytes()) : null, data: acc.data, treeInfo: merkleContext, leafIndex: acc.leafIndex, proveByIndex: false, readOnly: false };
    } catch (e) { throw e; }
};

export default function Register() {
    const { connection } = useConnection();
    const { publicKey, connected, signTransaction, signMessage } = useWallet();
    const [handle, setHandle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);

    // Stealth ID State
    const [stealthKeypair, setStealthKeypair] = useState<Keypair | null>(null);
    const [stealthBalance, setStealthBalance] = useState<number>(0);
    const [fundingLoading, setFundingLoading] = useState(false);
    const [isCheckingBalance, setIsCheckingBalance] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Derive or refresh Stealth Identity
    const deriveIdentity = async () => {
        if (!publicKey || !signMessage || !handle) return;
        try {
            const validationError = validateHandle(handle);
            if (validationError) return;

            const messageText = `Generate Stealth Link Identity`;
            const message = new TextEncoder().encode(messageText);
            const signature = await signMessage(message);
            const hashBuffer = await crypto.subtle.digest("SHA-256", signature as any);
            const seed = new Uint8Array(hashBuffer);
            const kp = Keypair.fromSeed(seed);
            setStealthKeypair(kp);
            refreshStealthBalance(kp.publicKey);
        } catch (e: any) {
            setError(e.message || "Failed to derive identity");
        }
    };

    const refreshStealthBalance = async (pubkey: PublicKey) => {
        setIsCheckingBalance(true);
        try {
            const bal = await connection.getBalance(pubkey);
            setStealthBalance(bal / LAMPORTS_PER_SOL);
        } catch (e) {
            console.error("Balance fetch failed", e);
        } finally {
            setIsCheckingBalance(false);
        }
    };

    // Watch handle change to reset derived key
    useEffect(() => {
        setStealthKeypair(null);
        setStealthBalance(0);
        setError(null);
        setSuccess(null);
    }, [handle]);

    // Validate handle input
    const validateHandle = (input: string): string | null => {
        if (input.length === 0) return "Handle cannot be empty";
        if (input.length > 32) return "Handle must be 32 characters or less";
        if (!/^[a-zA-Z0-9_]+$/.test(input)) return "Handle can only contain letters, numbers, and underscores";
        return null;
    };

    const handleFundIdentity = async () => {
        if (!publicKey || !signTransaction || !stealthKeypair) return;
        setFundingLoading(true);
        setError(null);

        try {
            const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
            if (!heliusRpc) throw new Error("Missing RPC configuration");

            const rpc = createRpc(heliusRpc, heliusRpc);
            const accounts = await rpc.getCompressedAccountsByOwner(publicKey);

            const validAccounts = accounts.items.filter((acc: any) => acc.treeInfo?.treeType !== 3);
            if (validAccounts.length === 0) {
                throw new Error("No private funds found. Please shield some SOL on the Dashboard first for a private registration.");
            }

            const inputAccounts = validAccounts.map((acc: any, i: number) => hydrateAccount(acc, i));
            const validityProof = await rpc.getValidityProofV0(inputAccounts.map((a: any) => ({
                hash: a.hash, tree: a.treeInfo.tree, queue: a.treeInfo.queue
            })), []);

            // Send just enough for rent + safety (0.005 SOL)
            const amount = new BN(0.005 * LAMPORTS_PER_SOL);

            const instruction = await LightSystemProgram.decompress({
                payer: publicKey,
                inputCompressedAccounts: inputAccounts as any,
                toAddress: stealthKeypair.publicKey,
                lamports: amount,
                recentValidityProof: validityProof.compressedProof,
                recentInputStateRootIndices: validityProof.rootIndices
            });

            // Patch keys (writable fix)
            const SYSTEM_PROGRAM_IDS = ["11111111111111111111111111111111", "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV", "compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq", "HwXnGK3tPkkVY6P439H2p68AxpeuWXd5PcrAxFpbmfbA", "35hkDgaAKwMCaxRz2ocSZ6NaUrtKkyNqU6c4RV3tYJRh"];
            instruction.keys = instruction.keys.map((key: any) => {
                if (!key.isSigner && !SYSTEM_PROGRAM_IDS.includes(key.pubkey.toBase58())) return { ...key, isWritable: true };
                return key;
            });

            const { blockhash } = await connection.getLatestBlockhash();
            const messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: blockhash,
                instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), instruction],
            }).compileToV0Message();

            const versionedTransaction = new VersionedTransaction(messageV0);
            const signed = await signTransaction(versionedTransaction as any);
            const sig = await connection.sendRawTransaction(signed.serialize());

            await connection.confirmTransaction(sig);
            await refreshStealthBalance(stealthKeypair.publicKey);
            setSuccess("Stealth Identity funded privately! You can now register anonymously.");
        } catch (e: any) {
            setError(e.message || "Funding failed");
        } finally {
            setFundingLoading(false);
        }
    };

    const handleRegister = useCallback(async () => {
        if (!stealthKeypair) {
            setError("Please derive your identity first");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Derive PDA for the registry entry
            const [registryPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("stealth"), Buffer.from(handle)],
                STEALTH_REGISTRY_PROGRAM_ID
            );

            // Build instruction data
            const handleBytes = Buffer.from(handle);
            const destinationBytes = stealthKeypair.publicKey.toBuffer();
            const instructionData = Buffer.concat([
                REGISTER_DISCRIMINATOR,
                Buffer.from(new Uint32Array([handleBytes.length]).buffer),
                handleBytes,
                destinationBytes
            ]);

            // Create instruction - ONLY Stealth Identity signs
            const registerInstruction = new TransactionInstruction({
                programId: STEALTH_REGISTRY_PROGRAM_ID,
                keys: [
                    { pubkey: stealthKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: registryPda, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                data: instructionData,
            });

            const transaction = new Transaction().add(registerInstruction);
            transaction.feePayer = stealthKeypair.publicKey;
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            transaction.sign(stealthKeypair);
            console.log("Sending registration transaction signed by Stealth Identity:", stealthKeypair.publicKey.toBase58());

            const txSig = await connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });
            console.log("Transaction sent. Signature:", txSig);

            const confirmation = await connection.confirmTransaction({
                signature: txSig,
                blockhash: blockhash,
                lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
            }, "confirmed");

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            setTxSignature(txSig);
            setSuccess(`Successfully registered ${handle}.stealth anonymously!`);
            setHandle("");
        } catch (e: any) {
            console.error("Registration error:", e);
            setError(e.message || "Registration failed. Ensure your Stealth Identity has ≈0.003 SOL.");
        } finally {
            setLoading(false);
        }
    }, [connection, handle, stealthKeypair]);

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 cyber-grid opacity-30" />
            <div className="absolute inset-0 cyber-radial" />

            <div className="relative max-w-2xl mx-auto px-6 py-12">
                <header className="mb-12">
                    <Link href="/dashboard" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-cyan-400 hover:bg-white/10 transition-colors mb-6">
                        <ArrowRight className="w-3 h-3 rotate-180" />
                        Back to Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-8 h-8 text-purple-500" />
                        <h1 className="text-4xl font-bold font-mono tracking-tighter">Register <span className="text-gradient-purple-pink">.stealth</span></h1>
                    </div>
                    <p className="text-gray-400 text-sm">
                        Create your private handle. This handle will be used in donation links to keep your wallet address completely hidden from the public.
                    </p>
                </header>

                <main className="space-y-8">
                    {!connected ? (
                        <Card variant="terminal" className="border-cyan-500/30 text-center py-10">
                            <CardHeader>
                                <Wallet className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                                <CardTitle>Connect Wallet</CardTitle>
                                <CardDescription>Connect your Solana wallet to manage your private handles.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-center">
                                    {mounted && <WalletMultiButton />}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Step 1: Handle Entry */}
                            <Card variant="terminal" className="border-white/10">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-mono flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">Step 1</Badge>
                                            Choose your Handle
                                        </CardTitle>
                                        {handle && !validateHandle(handle) && (
                                            <Badge variant="purple" className="text-[10px]">AVAILABLE</Badge>
                                        )}
                                    </div>
                                    <CardDescription>Letters, numbers, and underscores only.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            placeholder="my_secret_handle"
                                            value={handle}
                                            onChange={(e) => setHandle(e.target.value.toLowerCase())}
                                            className="font-mono text-lg bg-white/5 border-white/10 focus:border-purple-500/50 pr-24 h-14"
                                            disabled={loading || stealthKeypair !== null}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm pointer-events-none">
                                            .stealth
                                        </div>
                                    </div>

                                    {!stealthKeypair ? (
                                        <Button
                                            onClick={deriveIdentity}
                                            disabled={!handle || !!validateHandle(handle)}
                                            className="w-full h-12 bg-purple-600 hover:bg-purple-700 font-mono"
                                        >
                                            <Zap className="w-4 h-4 mr-2" />
                                            Derive Private Identity
                                        </Button>
                                    ) : (
                                        <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-3">
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-gray-400">Stealth Identity:</span>
                                                <span className="text-purple-400 truncate ml-4">{stealthKeypair.publicKey.toBase58()}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-gray-400">SOL Balance:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={stealthBalance >= 0.003 ? "text-green-400" : "text-yellow-400 animate-pulse"}>
                                                        {stealthBalance.toFixed(4)} SOL
                                                    </span>
                                                    <button onClick={() => refreshStealthBalance(stealthKeypair.publicKey)} disabled={isCheckingBalance}>
                                                        <RefreshCw className={`w-3 h-3 text-gray-500 hover:text-white transition-colors ${isCheckingBalance ? 'animate-spin' : ''}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Step 2: Privacy Check & Funding */}
                            {stealthKeypair && (
                                <Card variant="terminal" className={`border-white/10 ${stealthBalance < 0.003 ? "opacity-100" : "opacity-60 grayscale hover:grayscale-0 transition-all"}`}>
                                    <CardHeader>
                                        <CardTitle className="text-lg font-mono flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">Step 2</Badge>
                                            Privacy Check
                                        </CardTitle>
                                        <CardDescription>
                                            To prevent on-chain links to your main wallet, your Stealth Identity must pay for its own registration.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {stealthBalance < 0.003 ? (
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-3 p-3 rounded bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-200/80 leading-relaxed">
                                                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                                    <p>Your Stealth Identity has insufficient SOL for rent. Funded it privately from your Light Protocol pool to maintain 100% anonymity.</p>
                                                </div>
                                                <Button
                                                    onClick={handleFundIdentity}
                                                    disabled={fundingLoading}
                                                    variant="outline"
                                                    className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10 font-mono"
                                                >
                                                    {fundingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                                                    {fundingLoading ? "Unshielding..." : "Seed from Privacy Pool (0.005 SOL)"}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-green-400 font-mono text-sm py-2">
                                                <Check className="w-4 h-4" />
                                                Identity Funded & Autonomous
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Step 3: Registration */}
                            {stealthKeypair && stealthBalance >= 0.003 && (
                                <Button
                                    onClick={handleRegister}
                                    disabled={loading || !!validateHandle(handle)}
                                    className="w-full h-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 font-bold text-lg shadow-lg shadow-purple-500/20 animate-in fade-in slide-in-from-bottom-2"
                                >
                                    {loading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>Finalize Anonymous Registration</>
                                    )}
                                </Button>
                            )}

                            {error && (
                                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm animate-shake">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <p className="font-mono">{error}</p>
                                </div>
                            )}

                            {success && (
                                <Card variant="terminal" className="border-green-500/50 bg-green-500/5 animate-in zoom-in-95">
                                    <CardContent className="pt-6 text-center space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto text-green-500">
                                            <Check className="w-8 h-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-bold font-mono text-green-400">Success!</h3>
                                            <p className="text-sm text-green-300/70">{success}</p>
                                        </div>
                                        {txSignature && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-green-500/30 text-green-400 hover:bg-green-500/10 font-mono text-[10px]"
                                                asChild
                                            >
                                                <a href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
                                                    View Transaction <ExternalLink className="w-3 h-3 ml-2" />
                                                </a>
                                            </Button>
                                        )}
                                        <Link href="/dashboard" className="block text-xs text-gray-500 hover:text-white underline font-mono">
                                            Go to Dashboard
                                        </Link>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </main>

                <footer className="mt-20 text-center space-y-6">
                    <div className="flex justify-center gap-6 grayscale opacity-40">
                        <Shield className="w-5 h-5" />
                        <Zap className="w-5 h-5" />
                        <Terminal className="w-5 h-5" />
                    </div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-[0.2em]">
                        Privacy Registry v2.0 • Zero Knowledge Proofs Enabled
                    </p>
                </footer>
            </div>
        </div>
    );
}
