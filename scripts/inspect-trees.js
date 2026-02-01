/**
 * Inspect available state trees on the network
 * Run with: node scripts/inspect-trees.js
 */

const { createRpc } = require("@lightprotocol/stateless.js");

async function main() {
    // Helius devnet RPC
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=69ce5e56-f9a6-409d-9155-bfc8f799c172";

    console.log("Connecting to:", rpcUrl.substring(0, 50) + "...\n");

    const rpc = createRpc(rpcUrl, rpcUrl);

    try {
        const stateTrees = await rpc.getStateTreeInfos();
        console.log("=== State Trees on Network ===");
        console.log(`Total trees: ${stateTrees.length}\n`);

        const treeTypes = { 1: "StateV1", 2: "StateV2", 3: "BatchedAddress" };

        stateTrees.forEach((t, i) => {
            console.log(`[${i}] Tree: ${t.tree.toBase58()}`);
            console.log(`    Queue: ${t.queue.toBase58()}`);
            console.log(`    Type: ${t.treeType} (${treeTypes[t.treeType] || "Unknown"})`);
            console.log("");
        });

        // Summary
        const v1Count = stateTrees.filter(t => t.treeType === 1).length;
        const v2Count = stateTrees.filter(t => t.treeType === 2).length;
        const v3Count = stateTrees.filter(t => t.treeType === 3).length;

        console.log("=== Summary ===");
        console.log(`V1 (StateV1): ${v1Count} trees - COMPATIBLE with unshield`);
        console.log(`V2 (StateV2): ${v2Count} trees`);
        console.log(`V3 (BatchedAddress): ${v3Count} trees - NOT compatible with unshield`);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
