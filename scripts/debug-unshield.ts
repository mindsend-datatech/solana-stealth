
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { LightSystemProgram, bn } from "@lightprotocol/stateless.js";
import { BN } from "bn.js";

// Mock Data from previous logs
const owner = new Keypair();
const tree = new PublicKey("smt2rJAFdyJJupwMKAqTNAJwvjhmiZ4JYGZmbVRw1Ho"); // The one causing escalation
const queue = new PublicKey("nfq2hgS7NYemXsFaFUCe3EMXSDSfnZnAe27jC6aPP1X"); // Likely corresponding queue

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
        treeType: 3, // StateV2 (Guessing based on smt2 prefix)
        cpiContext: null
    }
};

// Mock Proof
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
    console.log("🔍 Debugging Unshield Instruction Generation...");

    try {
        const instruction = await LightSystemProgram.decompress({
            payer: owner.publicKey,
            inputCompressedAccounts: [mockHydratedAccount] as any,
            toAddress: owner.publicKey,
            lamports: new BN(100000000),
            recentValidityProof: mockProof.compressedProof as any,
            recentInputStateRootIndices: [0]
        });

        console.log("✅ Instruction Generated.");
        console.log("🔑 Checking Keys for Escalation Candidate:", tree.toBase58());

        const treeKey = instruction.keys.find(k => k.pubkey.toBase58() === tree.toBase58());

        if (treeKey) {
            console.log(`Found Tree Key: ${treeKey.pubkey.toBase58()}`);
            console.log(`- isSigner: ${treeKey.isSigner}`);
            console.log(`- isWritable: ${treeKey.isWritable}`);

            if (!treeKey.isWritable) {
                console.log("⚠️  ESCALATION RISK: Tree is Read-Only, but simulation failed saying it escalated to Writable!");
            }
        } else {
            console.log("❌ Tree Key NOT found in instruction keys!");
        }

    } catch (e) {
        console.error("❌ Failed to generate instruction:", e);
    }
}

main();
