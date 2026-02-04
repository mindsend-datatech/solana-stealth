
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction
} from "@solana/web3.js";
import { Buffer } from "buffer";
import crypto from "crypto";

// Configuration
const RPC_URL = "https://api.devnet.solana.com";
const STEALTH_REGISTRY_PROGRAM_ID = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

// Discriminator calculation
function getDiscriminator(name: string) {
    const preimage = `global:${name}`;
    const hash = crypto.createHash("sha256").update(preimage).digest();
    return hash.subarray(0, 8);
}

const REGISTER_DISCRIMINATOR = getDiscriminator("register");
console.log("Discriminator:", REGISTER_DISCRIMINATOR);

async function main() {
    const connection = new Connection(RPC_URL, "confirmed");
    const payer = Keypair.generate();

    console.log("Payer:", payer.publicKey.toBase58());

    // Airdrop
    console.log("Airdropping SOL...");
    try {
        const sig = await connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig);
    } catch (e) {
        console.error("Airdrop failed (might be rate limited). please provide a funded keypair if needed.");
        // Try to proceed if already funded or hope for the best
    }

    // Generate handle
    const handle = "test_" + Math.floor(Math.random() * 10000);
    console.log("Registering handle:", handle);

    // Derive PDA
    const [registryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stealth"), Buffer.from(handle)],
        STEALTH_REGISTRY_PROGRAM_ID
    );
    console.log("Registry PDA:", registryPda.toBase58());

    // Destination (can be random)
    const destinationKp = Keypair.generate();

    // Build instruction data
    const handleBytes = Buffer.from(handle);
    const handleLen = Buffer.alloc(4);
    handleLen.writeUInt32LE(handleBytes.length, 0);

    const instructionData = Buffer.concat([
        REGISTER_DISCRIMINATOR,
        handleLen,
        handleBytes,
        destinationKp.publicKey.toBuffer()
    ]);

    // Build Keys
    const keys = [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: registryPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
        programId: STEALTH_REGISTRY_PROGRAM_ID,
        keys: keys,
        data: instructionData,
    });

    const transaction = new Transaction().add(instruction);

    // Send
    console.log("Sending transaction...");
    try {
        const txSig = await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log("Success! Signature:", txSig);
    } catch (e: any) {
        console.error("Transaction failed:", e);
        if (e.logs) {
            console.log("Logs:");
            e.logs.forEach((log: string) => console.log(log));
        }
    }
}

main();
