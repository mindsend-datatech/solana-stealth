
import { Connection, PublicKey } from "@solana/web3.js";
import { createRpc } from "@lightprotocol/stateless.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
    // const signature = "2UTLj8zs3ap8dXzxXun1MBTy7G4QJ7MFhfRWipQQboR98r2EG8ReuqFLxZ9Yzgjsz3KttDAi6eqB6mixHhTfwX4K";
    const targetOwner = "J5G1m8dBysdfxx9ek16b7G5gnKdzQNwQNK4vwEWat1Ti";
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=69ce5e56-f9a6-409d-9155-bfc8f799c172";

    console.log(`🔍 Inspecting Owner: ${targetOwner}`);
    console.log(`📡 RPC: ${rpcUrl}`);

    const connection = new Connection(rpcUrl, "confirmed");
    const rpc = createRpc(rpcUrl, rpcUrl);

    try {
        const accounts = await rpc.getCompressedAccountsByOwner(new PublicKey(targetOwner));
        console.log(`📦 Found ${accounts.items.length} accounts.`);

        accounts.items.forEach((acc: any, i) => {
            console.log(`\nAccount ${i}:`);
            console.log(`- Hash: ${acc.hash.toString()}`);
            if (acc.merkleContext) {
                console.log(`- Structure: Nested merkleContext`);
                console.log(`- Tree: ${acc.merkleContext.treeInfo.tree.toBase58()}`);
                console.log(`- Tree Type: ${acc.merkleContext.treeInfo.treeType}`);
            } else if (acc.treeInfo) {
                console.log(`- Structure: Flat treeInfo`);
                console.log(`- Tree: ${new PublicKey(acc.treeInfo.tree).toBase58()}`);
                console.log(`- Queue: ${new PublicKey(acc.treeInfo.queue).toBase58()}`);
                console.log(`- Tree Type: ${acc.treeInfo.treeType}`);
            } else {
                console.log("- Unknown Structure:", Object.keys(acc));
            }
        });

    } catch (e) {
        console.error("Error fetching accounts:", e);
    }
}

main();
