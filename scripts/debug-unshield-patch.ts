
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
    console.log("🔍 Testing Manual Patch for Unshield...");

    try {
        const instruction = await LightSystemProgram.decompress({
            payer: owner.publicKey,
            inputCompressedAccounts: [mockHydratedAccount] as any,
            toAddress: owner.publicKey,
            lamports: new BN(100000000),
            recentValidityProof: mockProof.compressedProof as any,
            recentInputStateRootIndices: [0]
        });

        console.log("✅ Instruction Generated (V1 Logic).");

        // FIND AND PATCH
        const treeKey = instruction.keys.find(k => k.pubkey.toBase58() === tree.toBase58());
        if (treeKey) {
            console.log(`Original: isWritable=${treeKey.isWritable}`);
            // PATCH
            treeKey.isWritable = true;
            console.log(`Patched:  isWritable=${treeKey.isWritable}`);
        } else {
            console.log("❌ Tree Key NOT found in instruction keys!");
        }

    } catch (e) {
        console.error("❌ Failed to generate instruction:", e);
    }
}

main();
