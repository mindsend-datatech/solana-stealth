
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { LightSystemProgram, bn } from "@lightprotocol/stateless.js";
import { BN } from "bn.js";

// Mock Data matching User's Failure
const owner = new Keypair();
const tree = new PublicKey("smt2rJAFdyJJupwMKAqTNAJwvjhmiZ4JYGZmbVRw1Ho");
const queue = new PublicKey("nfq2hgS7NYemXsFaFUCe3EMXSDSfnZnAe27jC6aPP1X");

const mockHydratedAccount = {
    owner: owner.publicKey,
    lamports: new BN(100000000),
    hash: new BN("1343458523363569370438826759306160571864204304388345037487090567007663755904", 10),
    data: new Uint8Array(0),
    address: Array.from(owner.publicKey.toBytes()),

    leafIndex: 0,
    readOnly: false,
    proveByIndex: false,

    treeInfo: {
        tree: tree,
        queue: queue,
        // FORCE V1 here to make SDK happy (mirroring what Helius returns)
        treeType: 1,
        cpiContext: null
    }
};

const mockProof = {
    compressedProof: { a: [0], b: [0], c: [0] },
    roots: [new BN(0)],
    rootIndices: [0],
    leafIndices: [0],
    leaves: [mockHydratedAccount.hash],
    treeInfos: [mockHydratedAccount.treeInfo],
    proveByIndices: [false]
};

async function main() {
    console.log("🔍 Testing Manual Patch Logic...");

    try {
        const instruction = await LightSystemProgram.decompress({
            payer: owner.publicKey,
            inputCompressedAccounts: [mockHydratedAccount] as any,
            toAddress: owner.publicKey,
            lamports: new BN(100000000),
            recentValidityProof: mockProof.compressedProof as any,
            recentInputStateRootIndices: [0]
        });

        console.log("✅ Instruction Generated without patch.");
        // Simulate what's in page.tsx
        const inputAccounts = [mockHydratedAccount];

        // --- PATCH START ---
        const accountsToEscalate = new Set<string>();
        inputAccounts.forEach((acc: any) => {
            if (acc.treeInfo) {
                accountsToEscalate.add(acc.treeInfo.tree.toBase58());
                accountsToEscalate.add(acc.treeInfo.queue.toBase58());
            }
        });

        console.log("DEBUG: Accounts identified for escalation:", Array.from(accountsToEscalate));
        // console.log("DEBUG: Original Keys:", instruction.keys.map(k => ({ pubkey: k.pubkey.toBase58(), isWritable: k.isWritable, isSigner: k.isSigner })));

        // 1. Modify existing keys
        instruction.keys.forEach((k, idx) => {
            if (accountsToEscalate.has(k.pubkey.toBase58())) {
                // Only log if we are changing it to avoid spam, but force it anyway
                if (!k.isWritable) {
                    console.log(`PATCH: Upgrading Key at index ${idx} (${k.pubkey.toBase58()}) to Writable`);
                    k.isWritable = true;
                }
            }
        });

        // 2. Append missing keys
        accountsToEscalate.forEach(addr => {
            const exists = instruction.keys.find(k => k.pubkey.toBase58() === addr);
            if (!exists) {
                console.log(`PATCH: Appending MISSING Key (${addr}) as Writable`);
                instruction.keys.push({
                    pubkey: new PublicKey(addr),
                    isSigner: false,
                    isWritable: true
                });
            }
        });
        // --- PATCH END ---

        // Check if our target tree is there and writable
        const targetTree = instruction.keys.find(k => k.pubkey.toBase58() === tree.toBase58());
        console.log("--- FINAL CHECK ---");
        if (targetTree) {
            console.log(`Tree ${tree.toBase58()} found.`);
            console.log(`isWritable: ${targetTree.isWritable}`);
            if (!targetTree.isWritable) {
                console.error("FAIL: Tree is still Read-Only!");
            } else {
                console.log("SUCCESS: Tree is Writable.");
            }
        } else {
            console.error("FAIL: Tree NOT found in keys!");
        }

        const targetQueue = instruction.keys.find(k => k.pubkey.toBase58() === queue.toBase58());
        if (targetQueue) {
            console.log(`Queue ${queue.toBase58()} found.`);
            console.log(`isWritable: ${targetQueue.isWritable}`);
        } else {
            console.log(`Queue ${queue.toBase58()} NOT found.`);
        }

    } catch (e) {
        console.error("❌ Failed to generate instruction:", e);
    }
}

main();
