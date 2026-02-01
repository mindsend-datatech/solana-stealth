"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from "@solana/web3.js";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Terminal, Zap, ExternalLink, ArrowRight, Check, Loader2, AlertTriangle, Wallet } from "lucide-react";

// Stealth Registry Program ID (Devnet)
const STEALTH_REGISTRY_PROGRAM_ID = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

// Anchor discriminator for "register" instruction
// sha256("global:register")[0..8] - precomputed
const REGISTER_DISCRIMINATOR = Buffer.from([211, 124, 67, 15, 211, 194, 178, 240]);

export default function Register() {
    const { connection } = useConnection();
    const { publicKey, connected, signTransaction, signMessage } = useWallet();
    const [handle, setHandle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Validate handle input
    const validateHandle = (input: string): string | null => {
        if (input.length === 0) return "Handle cannot be empty";
        if (input.length > 32) return "Handle must be 32 characters or less";
        if (!/^[a-zA-Z0-9_]+$/.test(input)) return "Handle can only contain letters, numbers, and underscores";
        return null;
    };

    const handleRegister = useCallback(async () => {
        if (!publicKey || !signTransaction) {
            setError("Please connect your wallet first");
            return;
        }

        const validationError = validateHandle(handle);
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // 1. Derive Stealth Identity (Deterministic Keypair)
            // This ensures the receiving address is different from the main wallet ("privacy on contract side")
            // but is deterministically recoverable by the user signing the same message.
            if (!signMessage) {
                setError("Wallet does not support message signing");
                return;
            }

            const messageText = `Sign this message to generate your Stealth Identity for ${handle}.stealth`;
            const message = new TextEncoder().encode(messageText);
            const signature = await signMessage(message);

            // Hash signature to get 32-byte seed
            const hashBuffer = await crypto.subtle.digest("SHA-256", signature as any);
            const seed = new Uint8Array(hashBuffer);
            const stealthKeypair = Keypair.fromSeed(seed);
            const destinationKey = stealthKeypair.publicKey;

            // Derive PDA for the registry entry
            const [registryPda, bump] = PublicKey.findProgramAddressSync(
                [Buffer.from("stealth"), Buffer.from(handle)],
                STEALTH_REGISTRY_PROGRAM_ID
            );

            // Check if handle is already registered
            const existingAccount = await connection.getAccountInfo(registryPda);
            if (existingAccount) {
                setError(`Handle "${handle}.stealth" is already registered`);
                setLoading(false);
                return;
            }

            // Build the instruction data
            // Format: [8 bytes discriminator] + [4 bytes string length] + [handle bytes] + [32 bytes destination key]
            const handleBytes = Buffer.from(handle);
            const destinationBytes = destinationKey.toBuffer();

            const instructionData = Buffer.concat([
                REGISTER_DISCRIMINATOR,
                Buffer.from(new Uint32Array([handleBytes.length]).buffer),
                handleBytes,
                destinationBytes
            ]);

            // Create the register instruction
            const registerInstruction = new TransactionInstruction({
                programId: STEALTH_REGISTRY_PROGRAM_ID,
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },      // payer (Main Wallet)
                    { pubkey: destinationKey, isSigner: true, isWritable: true }, // authority (Stealth Identity)
                    { pubkey: registryPda, isSigner: false, isWritable: true },   // registry_entry PDA
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
                ],
                data: instructionData,
            });

            // Build and send transaction
            const transaction = new Transaction().add(registerInstruction);
            transaction.feePayer = publicKey;
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            // 1. Sign with the Stealth Identity (Authority)
            transaction.partialSign(stealthKeypair);

            // 2. Sign with the Main Wallet (Payer)
            const signed = await signTransaction(transaction);

            // 3. Send
            const txSig = await connection.sendRawTransaction(signed.serialize());
            await connection.confirmTransaction(txSig);

            setTxSignature(txSig);
            setSuccess(`Successfully registered ${handle}.stealth! Private Identity: ${destinationKey.toBase58().slice(0, 6)}...`);
            setHandle(""); // Clear input

        } catch (e: any) {
            console.error("Registration error:", e);

            // Handle common errors with friendly messages
            if (e.message?.includes("0x0")) {
                setError("Handle is already registered");
            } else if (e.message?.includes("insufficient funds")) {
                setError("Insufficient SOL for transaction fees. Please fund your wallet.");
            } else if (e.message?.includes("User rejected")) {
                setError("Transaction was cancelled");
            } else {
                setError(e.message || "Failed to register handle. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, signMessage, connection, handle]);

    const inputValidation = handle ? validateHandle(handle) : null;
    const isValidInput = handle.length > 0 && !inputValidation;

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 cyber-grid opacity-30" />
            <div className="absolute inset-0 cyber-radial" />

            <div className="relative max-w-4xl mx-auto px-6 py-16">
                {/* Header */}
                <header className="flex justify-between items-center mb-16">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight group-hover:text-purple-400 transition-colors">Stealth Link</span>
                    </Link>
                    <WalletMultiButton />
                </header>

                <main className="space-y-12">
                    {/* Hero */}
                    <div className="text-center space-y-4">
                        <Badge variant="purple" className="gap-2">
                            <Terminal className="w-3 h-3" />
                            Register Your Handle
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                            Claim your{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 text-glow-purple">
                                .stealth
                            </span>{" "}
                            identity
                        </h1>
                        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                            Register a unique handle to receive anonymous donations. Your handle will be mapped to your wallet address on-chain.
                        </p>
                    </div>

                    {!connected ? (
                        <div className="text-center py-8">
                            <Card variant="glass" className="max-w-md mx-auto">
                                <CardContent className="py-12 space-y-6">
                                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                                        <Wallet className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                                        <p className="text-gray-400">
                                            Connect your Solana wallet to register a .stealth handle.
                                        </p>
                                    </div>
                                    {mounted && <WalletMultiButton />}
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="max-w-xl mx-auto space-y-8">
                            {/* Registration Form */}
                            <Card variant="glass" className="overflow-hidden">
                                <CardContent className="p-8 space-y-6">
                                    {/* Handle Input */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-gray-300">
                                            Choose your handle
                                        </label>
                                        <div className="relative">
                                            <Input
                                                variant="terminal"
                                                value={handle}
                                                onChange={(e) => {
                                                    setHandle(e.target.value.toLowerCase());
                                                    setError(null);
                                                    setSuccess(null);
                                                }}
                                                placeholder="yourname"
                                                maxLength={32}
                                                disabled={loading}
                                                className="pr-24 text-lg"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 font-mono font-medium">
                                                .stealth
                                            </span>
                                        </div>

                                        {/* Validation */}
                                        <div className="flex justify-between text-xs">
                                            <span>
                                                {inputValidation && handle.length > 0 ? (
                                                    <span className="text-red-400 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {inputValidation}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">Letters, numbers, and underscores only</span>
                                                )}
                                            </span>
                                            <span className={`font-mono ${handle.length > 28 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                                {handle.length}/32
                                            </span>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    {isValidInput && (
                                        <Card variant="terminal" className="p-4">
                                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                <Zap className="w-3 h-3 text-cyan-400" />
                                                Your Stealth Link Preview
                                            </div>
                                            <div className="font-mono text-sm text-cyan-400 break-all">
                                                stealth.link/donate/{handle}.stealth
                                            </div>
                                        </Card>
                                    )}

                                    {/* Error Message */}
                                    {error && (
                                        <Card variant="terminal" className="p-4 border-red-500/50">
                                            <div className="text-red-400 text-sm flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                {error}
                                            </div>
                                        </Card>
                                    )}

                                    {/* Success Message */}
                                    {success && (
                                        <Card variant="terminal" className="p-4 border-green-500/50 space-y-3">
                                            <div className="text-green-400 font-medium flex items-center gap-2">
                                                <Check className="w-4 h-4" />
                                                {success}
                                            </div>
                                            {txSignature && (
                                                <a
                                                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    View on Solana Explorer
                                                </a>
                                            )}
                                            <Link href="/dashboard">
                                                <Button variant="outline" size="sm" className="gap-2 mt-2">
                                                    Go to Dashboard
                                                    <ArrowRight className="w-3 h-3" />
                                                </Button>
                                            </Link>
                                        </Card>
                                    )}

                                    {/* Register Button */}
                                    <Button
                                        onClick={handleRegister}
                                        disabled={!isValidInput || loading}
                                        size="lg"
                                        className="w-full gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Registering...
                                            </>
                                        ) : (
                                            <>
                                                <Terminal className="w-4 h-4" />
                                                Register {handle || "handle"}.stealth
                                            </>
                                        )}
                                    </Button>

                                    {/* Info */}
                                    <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-800">
                                        <p className="flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-yellow-400" />
                                            Registration requires ≈0.002 SOL for on-chain storage.
                                        </p>
                                        <p className="flex items-center gap-1">
                                            <Shield className="w-3 h-3 text-purple-400" />
                                            Your handle is permanently linked to your connected wallet.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Steps */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card variant="glass" className="group hover:border-purple-500/30 transition-all">
                                    <CardContent className="py-5">
                                        <h3 className="font-bold mb-2 flex items-center gap-2">
                                            <Badge variant="purple" className="w-6 h-6 p-0 flex items-center justify-center">1</Badge>
                                            Register
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            Claim your unique .stealth handle on the Solana blockchain.
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card variant="glass" className="group hover:border-purple-500/30 transition-all">
                                    <CardContent className="py-5">
                                        <h3 className="font-bold mb-2 flex items-center gap-2">
                                            <Badge variant="purple" className="w-6 h-6 p-0 flex items-center justify-center">2</Badge>
                                            Share
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            Share your Stealth Link on Twitter/X to receive private donations.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
