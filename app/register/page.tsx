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
    // Transaction Status State
    type TxStatus = 'idle' | 'signing' | 'sending' | 'confirming' | 'success' | 'error';
    const [txStatus, setTxStatus] = useState<TxStatus>('idle');

    // UI State
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
    const deriveIdentity = async (): Promise<Keypair | null> => {
        if (!publicKey || !signMessage || !handle) return null;
        try {
            const validationError = validateHandle(handle);
            if (validationError) return null;

            const messageText = `Generate Stealth Link Identity`;
            const message = new TextEncoder().encode(messageText);
            const signature = await signMessage(message);
            const hashBuffer = await crypto.subtle.digest("SHA-256", signature as any);
            const seed = new Uint8Array(hashBuffer);
            const kp = Keypair.fromSeed(seed);
            setStealthKeypair(kp);
            refreshStealthBalance(kp.publicKey);
            return kp;
        } catch (e: any) {
            setError(e.message || "Failed to derive identity");
            return null;
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
        setTxStatus('idle');
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

    const handleRegister = useCallback(async (providedKp?: Keypair) => {
        const activeKp = providedKp || stealthKeypair;
        if (!publicKey || !activeKp || !handle) {
            setError("Missing wallet or handle. Please try again.");
            return;
        }

        setTxStatus('signing');
        setError(null);
        setSuccess(null);

        try {
            console.log("[Register] Starting registration for handle:", handle);

            // 1. Correct seeds: b"stealth" + handle bytes
            const [registryPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("stealth"), Buffer.from(handle)],
                STEALTH_REGISTRY_PROGRAM_ID
            );
            console.log("[Register] Registry PDA:", registryPda.toBase58());

            // 2. Build Borsh Data: Discriminator (8) + String (4 + N) + Pubkey (32)
            const handleBytes = Buffer.from(handle);
            const handleLen = Buffer.alloc(4);
            handleLen.writeUInt32LE(handleBytes.length, 0);

            const instructionData = Buffer.concat([
                REGISTER_DISCRIMINATOR,
                handleLen,
                handleBytes,
                activeKp.publicKey.toBuffer() // destination_pubkey = Stealth Identity
            ]);

            // Instruction: Register
            // Program expects: [Authority/Payer, RegistryEntry, SystemProgram]
            const authorityKey = new PublicKey(publicKey.toBase58());
            const pdaKey = new PublicKey(registryPda.toBase58());
            const systemKey = new PublicKey(SystemProgram.programId.toBase58());

            console.log("[Register v5 Debug] Authority (Wallet):", authorityKey.toBase58());
            console.log("[Register v5 Debug] PDA:", pdaKey.toBase58());

            if (authorityKey.equals(pdaKey)) {
                throw new Error("Critical Error: Wallet Address matches PDA. This should never happen.");
            }

            const keys = [
                { pubkey: authorityKey, isSigner: true, isWritable: true },
                { pubkey: pdaKey, isSigner: false, isWritable: true },
                { pubkey: systemKey, isSigner: false, isWritable: false },
            ];

            console.log("[Register v5 Debug] Final Keys JSON:", JSON.stringify(keys.map(k => ({
                pubkey: k.pubkey.toBase58(),
                isSigner: k.isSigner,
                isWritable: k.isWritable
            }))));

            const registerInstruction = new TransactionInstruction({
                programId: STEALTH_REGISTRY_PROGRAM_ID,
                keys: keys,
                data: instructionData,
            });

            // 5. Build Transaction
            const transaction = new Transaction().add(registerInstruction);
            transaction.feePayer = publicKey;
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            // 6. Signature Flow
            if (!signTransaction) throw new Error("Wallet does not support signing");

            console.log("[Register] Requesting signature from main wallet...");
            const signedTransaction = await signTransaction(transaction);

            setTxStatus('sending');
            console.log("[Register] Sending transaction...");
            const txSig = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: true,
                preflightCommitment: "processed"
            });

            console.log(`[Register] Broadcasted! Signature: ${txSig}`);
            setTxSignature(txSig);

            setTxStatus('confirming');
            await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, "confirmed");

            setTxStatus('success');
            setSuccess(`Successfully registered ${handle}.stealth!`);
            setHandle("");
        } catch (e: any) {
            console.error("Registration error:", e);
            setTxStatus('error');
            setError(`Error: ${e.message || "Registration failed"}.`);
        }
    }, [connection, handle, stealthKeypair, publicKey, signTransaction]);

    const handleUnifiedAction = async () => {
        setError(null);
        setSuccess(null);

        let kp = stealthKeypair;
        if (!kp) {
            console.log("[Unified] Deriving identity first...");
            kp = await deriveIdentity();
            if (!kp) return;
        }

        console.log("[Unified] Proceeding to registration...");
        await handleRegister(kp);
    };

    const isHandleValid = !validateHandle(handle);
    const isActionDisabled = !isHandleValid || txStatus !== 'idle' && txStatus !== 'error' || fundingLoading;

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
                            <Card variant="terminal" className="border-white/10">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-mono flex items-center gap-2">
                                            Register your Handle
                                        </CardTitle>
                                        {handle && isHandleValid && (
                                            <Badge variant="purple" className="text-[10px]">AVAILABLE</Badge>
                                        )}
                                    </div>
                                    <CardDescription>Letters, numbers, and underscores only.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            placeholder="my_secret_handle"
                                            value={handle}
                                            onChange={(e) => setHandle(e.target.value.toLowerCase())}
                                            className="font-mono text-xl bg-white/5 border-white/10 focus:border-purple-500/50 pr-24 h-16"
                                            disabled={txStatus !== 'idle' && txStatus !== 'error'}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-lg pointer-events-none">
                                            .stealth
                                        </div>
                                    </div>

                                    {!success && txStatus !== 'success' && (
                                        <Button
                                            onClick={() => handleUnifiedAction()}
                                            disabled={isActionDisabled}
                                            className="w-full h-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 font-bold text-lg shadow-lg shadow-purple-500/20"
                                        >
                                            {txStatus === 'idle' || txStatus === 'error' ? (
                                                <>Register .stealth</>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                    <span className="capitalize">{txStatus}...</span>
                                                </div>
                                            )}
                                        </Button>
                                    )}

                                    {(txStatus === 'sending' || txStatus === 'confirming' || txStatus === 'success') && (
                                        <div className={`p-4 rounded-lg border space-y-2 ${txStatus === 'success'
                                                ? "bg-green-500/5 border-green-500/20"
                                                : "bg-yellow-500/5 border-yellow-500/20 animate-pulse"
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <span className={`${txStatus === 'success' ? "text-green-400" : "text-yellow-400"} font-mono text-xs uppercase`}>Target Network</span>
                                                <span className="text-gray-400 font-mono text-xs">Solana Devnet</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`${txStatus === 'success' ? "text-green-400" : "text-yellow-400"} font-mono text-xs uppercase`}>Status</span>
                                                <span className="text-white font-mono text-xs font-bold capitalize">
                                                    {txStatus === 'success' ? 'Confirmed' : `${txStatus} Transaction...`}
                                                </span>
                                            </div>
                                            {txSignature && (
                                                <div className="pt-2 border-t border-white/5">
                                                    <a href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:underline font-mono">
                                                        {txStatus === 'success' ? 'View Transaction' : 'View Pending Tx'} <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* {stealthKeypair && !success && (
                                        <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-3">
                                        <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="text-gray-500 uppercase">Privacy Key (Stealth ID)</span>
                                        <span className="text-purple-400 truncate ml-4">{stealthKeypair?.publicKey.toBase58()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="text-gray-500 uppercase">SOL Balance</span>
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
                                        )} */}
                                </CardContent>
                            </Card>

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
                                            <div className="space-y-3">
                                                <div className="p-3 rounded bg-black/40 border border-white/5 text-left space-y-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-500 uppercase font-mono">Request Key</span>
                                                        <span className="text-xs font-mono text-cyan-400 truncate">{txSignature}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-500 uppercase font-mono">Stealth Identity</span>
                                                        <span className="text-xs font-mono text-purple-400 truncate">{stealthKeypair?.publicKey.toBase58()}</span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 border-white/10 hover:bg-white/5 font-mono text-[10px]"
                                                        asChild
                                                    >
                                                        <a href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer">
                                                            View on Explorer <ExternalLink className="w-3 h-3 ml-2" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
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
