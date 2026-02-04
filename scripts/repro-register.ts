
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import os from "os";

// Configuration
const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

// Load fee payer from ~/.config/solana/id.json
function loadFeePayer(): Keypair {
    const homeDir = os.homedir();
    const keyPath = path.join(homeDir, ".config", "solana", "id.json");
    const keyData = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(keyData));
}

async function main() {
    const connection = new Connection(RPC_URL, "confirmed");
    const feePayer = loadFeePayer();
    console.log("Fee Payer:", feePayer.publicKey.toBase58());

    // Generate a random stealth keypair
    const stealthKp = Keypair.generate();
    console.log("Stealth Identity:", stealthKp.publicKey.toBase58());

    // Generate a random handle
    const handle = "test_" + Math.floor(Math.random() * 10000);
    console.log("Handle:", handle);

    // 1. Derive PDA
    const [registryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stealth"), Buffer.from(handle)],
        PROGRAM_ID
    );
    console.log("Registry PDA:", registryPda.toBase58());

    // 2. Discriminator for "register"
    // sha256("global:register")[0..8] = [211, 124, 67, 15, 211, 194, 178, 240]
    const REGISTER_DISCRIMINATOR = Buffer.from([211, 124, 67, 15, 211, 194, 178, 240]);

    // 3. Build Data
    const handleBytes = Buffer.from(handle);
    const handleLen = Buffer.alloc(4);
    handleLen.writeUInt32LE(handleBytes.length, 0);

    // Destination pubkey (using fee payer as destination for simplicity)
    const destinationPubkey = feePayer.publicKey;

    const instructionData = Buffer.concat([
        REGISTER_DISCRIMINATOR,
        handleLen,
        handleBytes,
        destinationPubkey.toBuffer()
    ]);

    // 4. Instructions
    const fundInstruction = SystemProgram.transfer({
        fromPubkey: feePayer.publicKey,
        toPubkey: stealthKp.publicKey,
        lamports: 3000000, 
    });

    const registerInstruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: stealthKp.publicKey, isSigner: true, isWritable: true },
            { pubkey: registryPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData,
    });

    // 5. Build Transaction (Split)
    // Step A: Fund
    const fundTx = new Transaction().add(fundInstruction);
    try {
        console.log("Funding stealth keypair...");
        await sendAndConfirmTransaction(
            connection,
            fundTx,
            [feePayer],
            { skipPreflight: true, commitment: "confirmed" }
        );
        console.log("Funded.");
    } catch (e) {
        console.error("Funding failed:", e);
        return;
    }

    // Step B: Register
    const registerTx = new Transaction().add(registerInstruction);
    // Note: Fee payer is still feePayer, but stealthKp signs as authority
    try {
        console.log("Registering...");
        
        // Inspect transaction before sending
        registerTx.feePayer = feePayer.publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        registerTx.recentBlockhash = blockhash;
        registerTx.sign(feePayer, stealthKp);
        
        // Check signatures locally
        registerTx.signatures.forEach(sig => {
            console.log(`Signature for ${sig.publicKey.toBase58()}: ${sig.signature ? "Present" : "MISSING"}`);
        });

        // Check compiled message account keys and signer flags
        const msg = registerTx.compileMessage();
        msg.accountKeys.forEach((key, index) => {
            console.log(`Account ${index}: ${key.toBase58()} (Signer: ${msg.isAccountSigner(index)})`);
        });

        const sig = await connection.sendRawTransaction(registerTx.serialize());
        console.log("Sent. Signature:", sig);
        await connection.confirmTransaction(sig);
        console.log("Confirmed!");

    } catch (e: any) {
        console.error("Registration failed:", e);
        if (e.logs) {
            console.log("Logs:", e.logs);
        }
    }
}

main();
