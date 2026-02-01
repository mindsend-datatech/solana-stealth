/**
 * Test script to diagnose decompress issues
 * Run with: npx ts-node scripts/test-decompress.ts
 */

import { createRpc, LightSystemProgram } from "@lightprotocol/stateless.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";

// Load env
require("dotenv").config({ path: ".env.local" });

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
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
        const lamports = parseInt(acc.lamports.toString(16), 16);
        console.log(`   - Tree: ${acc.treeInfo.tree}`);
        console.log(`     Queue: ${acc.treeInfo.queue}`);
        console.log(`     TreeType: ${acc.treeInfo.treeType}`);
        console.log(`     Hash: ${acc.hash}`);
        console.log(`     Lamports: ${lamports / 1e9} SOL`);
        console.log(`     LeafIndex: ${acc.leafIndex}`);
        console.log(`     ProveByIndex: ${acc.proveByIndex}`);
        console.log("");
    }

    // 3. Get validity proof
    console.log("3. Getting validity proof...");
    const proofInputs = accounts.items.map(acc => ({
        hash: acc.hash,
        tree: acc.treeInfo.tree,
        queue: acc.treeInfo.queue
    }));

    const validityProof = await rpc.getValidityProofV0(proofInputs, []);
    console.log("   Root indices:", validityProof.rootIndices);

    // 4. Calculate total lamports
    const total = accounts.items.reduce((sum, acc) => {
        const lamportsHex = acc.lamports.toString();
        return sum.add(new BN(lamportsHex, 16));
    }, new BN(0));
    console.log(`\n4. Total lamports: ${total.toString()} (${total.toNumber() / 1e9} SOL)`);

    // 5. Try to build decompress instruction (just to see what the SDK produces)
    console.log("\n5. Building decompress instruction...");

    // Transform accounts to the expected format
    const inputAccounts = accounts.items.map(acc => {
        // Parse lamports from hex
        const lamportsStr = acc.lamports.toString();
        const lamports = new BN(lamportsStr, /[a-fA-F]/.test(lamportsStr) ? 16 : 10);

        // Parse hash - it's a hex string
        const hashStr = acc.hash.toString();
        const hash = new BN(hashStr, hashStr.length === 64 ? 16 : 10);

        return {
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
    });

    try {
        const instruction = await LightSystemProgram.decompress({
            payer: owner,
            inputCompressedAccounts: inputAccounts as any,
            toAddress: owner,
            lamports: total,
            recentValidityProof: validityProof.compressedProof,
            recentInputStateRootIndices: validityProof.rootIndices
        });

        console.log("   Program ID:", instruction.programId.toBase58());
        console.log("   Num keys:", instruction.keys.length);
        console.log("   Keys:");
        for (let i = 0; i < instruction.keys.length; i++) {
            const k = instruction.keys[i];
            console.log(`     [${i}] ${k.pubkey.toBase58()} - signer: ${k.isSigner}, writable: ${k.isWritable}`);
        }
        console.log("   Data length:", instruction.data.length);

    } catch (err: any) {
        console.error("   ERROR building instruction:", err.message);
        if (err.message.includes("V2")) {
            console.log("\n   >>> V2 trees are not supported by the current SDK version.");
            console.log("   >>> Your funds are in a V2 tree and cannot be unshielded yet.");
        }
    }
}

main().catch(console.error);
