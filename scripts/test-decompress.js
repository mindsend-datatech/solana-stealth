/**
 * Test script to diagnose decompress issues
 * Run with: node scripts/test-decompress.js
 */

const { createRpc, LightSystemProgram } = require("@lightprotocol/stateless.js");
const { PublicKey } = require("@solana/web3.js");
const BN = require("bn.js");
const fs = require("fs");

// Load env manually
const envContent = fs.readFileSync(".env.local", "utf8");
const envMatch = envContent.match(/NEXT_PUBLIC_HELIUS_RPC_URL=(.+)/);
const RPC_URL = envMatch ? envMatch[1].trim() : null;
const OWNER_PUBKEY = "BnjNayb9VwtFFqDA4eGxcy63HNPq15wg8w9WBXJmDQNh"; // Replace with your wallet

async function main() {
    if (!RPC_URL) {
        throw new Error("Missing NEXT_PUBLIC_HELIUS_RPC_URL");
    }

    console.log("Connecting to RPC:", RPC_URL.substring(0, 50) + "...");
    const rpc = createRpc(RPC_URL, RPC_URL);
    const owner = new PublicKey(OWNER_PUBKEY);

    // 1. Fetch all compressed accounts
    console.log("\n1. Fetching compressed accounts for:", owner.toBase58());
    const accounts = await rpc.getCompressedAccountsByOwner(owner);
    console.log("   Found:", accounts.items.length, "accounts");

    if (accounts.items.length === 0) {
        console.log("No compressed accounts found. Exiting.");
        return;
    }

    // 2. Log all accounts with details
    console.log("\n2. Account details:");
    for (const acc of accounts.items) {
        const lamportsHex = acc.lamports.toString();
        const lamports = new BN(lamportsHex, /[a-fA-F]/.test(lamportsHex) ? 16 : 10);
        console.log(`   - Tree: ${acc.treeInfo.tree}`);
        console.log(`     Queue: ${acc.treeInfo.queue}`);
        console.log(`     TreeType: ${acc.treeInfo.treeType}`);
        console.log(`     Hash: ${acc.hash}`);
        console.log(`     Lamports: ${lamports.toNumber() / 1e9} SOL`);
        console.log(`     LeafIndex: ${acc.leafIndex}`);
        console.log(`     ProveByIndex: ${acc.proveByIndex}`);
        console.log("");
    }

    // 3. Get the first account to test
    const acc = accounts.items[0];
    console.log("3. Testing with first account...");

    // Parse lamports and hash
    const lamportsHex = acc.lamports.toString();
    const lamports = new BN(lamportsHex, /[a-fA-F]/.test(lamportsHex) ? 16 : 10);

    const hashStr = acc.hash.toString();
    const hash = new BN(hashStr, hashStr.length === 64 ? 16 : 10);

    // 4. Get validity proof
    console.log("\n4. Getting validity proof...");
    const validityProof = await rpc.getValidityProofV0([{
        hash: acc.hash,
        tree: acc.treeInfo.tree,
        queue: acc.treeInfo.queue
    }], []);
    console.log("   Root indices:", validityProof.rootIndices);

    // 5. Build the input account structure
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

    console.log("\n5. Input account structure:");
    console.log("   owner:", inputAccount.owner.toBase58());
    console.log("   lamports:", inputAccount.lamports.toString());
    console.log("   hash:", inputAccount.hash.toString());
    console.log("   treeInfo.tree:", inputAccount.treeInfo.tree.toBase58());
    console.log("   treeInfo.queue:", inputAccount.treeInfo.queue.toBase58());
    console.log("   treeInfo.treeType:", inputAccount.treeInfo.treeType);
    console.log("   leafIndex:", inputAccount.leafIndex);
    console.log("   proveByIndex:", inputAccount.proveByIndex);

    // 6. Try to build decompress instruction
    console.log("\n6. Building decompress instruction...");

    try {
        const instruction = await LightSystemProgram.decompress({
            payer: owner,
            inputCompressedAccounts: [inputAccount],
            toAddress: owner,
            lamports: lamports,
            recentValidityProof: validityProof.compressedProof,
            recentInputStateRootIndices: validityProof.rootIndices
        });

        console.log("   SUCCESS! Instruction built.");
        console.log("   Program ID:", instruction.programId.toBase58());
        console.log("   Num keys:", instruction.keys.length);
        console.log("   Keys:");
        for (let i = 0; i < instruction.keys.length; i++) {
            const k = instruction.keys[i];
            console.log(`     [${i}] ${k.pubkey.toBase58()} - signer: ${k.isSigner}, writable: ${k.isWritable}`);
        }
        console.log("   Data length:", instruction.data.length);

    } catch (err) {
        console.error("   ERROR building instruction:", err.message);
        console.error("   Full error:", err);
        if (err.message.includes("V2")) {
            console.log("\n   >>> V2 trees are not supported by the current SDK version.");
            console.log("   >>> Your funds are in a V2 tree and cannot be unshielded yet.");
        }
    }
}

main().catch(console.error);
