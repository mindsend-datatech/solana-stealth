/**
 * Test script to simulate the decompress transaction
 * Run with: node scripts/simulate-decompress.js
 */

const { createRpc, LightSystemProgram } = require("@lightprotocol/stateless.js");
const { PublicKey, Transaction, Connection } = require("@solana/web3.js");
const BN = require("bn.js");
const fs = require("fs");

// Load env manually
const envContent = fs.readFileSync(".env.local", "utf8");
const envMatch = envContent.match(/NEXT_PUBLIC_HELIUS_RPC_URL=(.+)/);
const RPC_URL = envMatch ? envMatch[1].trim() : null;
const OWNER_PUBKEY = "BnjNayb9VwtFFqDA4eGxcy63HNPq15wg8w9WBXJmDQNh";

async function main() {
    if (!RPC_URL) {
        throw new Error("Missing NEXT_PUBLIC_HELIUS_RPC_URL");
    }

    console.log("Connecting to RPC:", RPC_URL.substring(0, 50) + "...");
    const rpc = createRpc(RPC_URL, RPC_URL);
    const connection = new Connection(RPC_URL, "confirmed");
    const owner = new PublicKey(OWNER_PUBKEY);

    // 1. Fetch accounts
    console.log("\n1. Fetching compressed accounts...");
    const accounts = await rpc.getCompressedAccountsByOwner(owner);
    console.log("   Found:", accounts.items.length, "accounts");

    if (accounts.items.length === 0) {
        console.log("No accounts found.");
        return;
    }

    // Use first account for testing
    const acc = accounts.items[0];
    const lamportsHex = acc.lamports.toString();
    const lamports = new BN(lamportsHex, /[a-fA-F]/.test(lamportsHex) ? 16 : 10);
    const hashStr = acc.hash.toString();
    const hash = new BN(hashStr, hashStr.length === 64 ? 16 : 10);

    console.log("   Testing with first account:");
    console.log("   - Lamports:", lamports.toString());
    console.log("   - Tree:", acc.treeInfo.tree);
    console.log("   - TreeType:", acc.treeInfo.treeType);

    // 2. Get validity proof
    console.log("\n2. Getting validity proof...");
    const validityProof = await rpc.getValidityProofV0([{
        hash: acc.hash,
        tree: acc.treeInfo.tree,
        queue: acc.treeInfo.queue
    }], []);
    console.log("   Root indices:", validityProof.rootIndices);

    // 3. Build input account
    const inputAccount = {
        owner: new PublicKey(acc.owner),
        lamports: lamports,
        hash: hash,
        address: acc.address ? Array.from(new PublicKey(acc.address).toBytes()) : null,
        data: acc.data,
        treeInfo: {
            tree: new PublicKey(acc.treeInfo.tree),
            queue: new PublicKey(acc.treeInfo.queue),
            treeType: acc.treeInfo.treeType,
            cpiContext: acc.treeInfo.cpiContext ? new PublicKey(acc.treeInfo.cpiContext) : undefined
        },
        leafIndex: acc.leafIndex,
        proveByIndex: acc.proveByIndex || false,
        readOnly: false
    };

    // 4. Build decompress instruction
    console.log("\n3. Building decompress instruction...");
    const instruction = await LightSystemProgram.decompress({
        payer: owner,
        inputCompressedAccounts: [inputAccount],
        toAddress: owner,
        lamports: lamports,
        recentValidityProof: validityProof.compressedProof,
        recentInputStateRootIndices: validityProof.rootIndices
    });
    console.log("   Instruction built successfully.");

    // 5. Build transaction
    console.log("\n4. Building transaction...");
    const transaction = new Transaction();
    transaction.add(instruction);
    transaction.feePayer = owner;

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    console.log("\n5. Simulating transaction...");
    try {
        // Compile transaction message for simulation
        const message = transaction.compileMessage();

        // Use RPC to get logs about the error
        const simulation = await connection.simulateTransaction(transaction);

        console.log("   Simulation result:");
        console.log("   - Error:", JSON.stringify(simulation.value.err, null, 2));
        console.log("   - Logs:");
        if (simulation.value.logs) {
            for (const log of simulation.value.logs) {
                console.log("     ", log);
            }
        }
        console.log("   - Units consumed:", simulation.value.unitsConsumed);

    } catch (err) {
        console.error("   Simulation error:", err.message);
        if (err.logs) {
            console.log("   Error logs:");
            for (const log of err.logs) {
                console.log("     ", log);
            }
        }
    }
}

main().catch(console.error);
