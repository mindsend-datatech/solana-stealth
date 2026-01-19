
import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=69ce5e56-f9a6-409d-9155-bfc8f799c172";
    const connection = new Connection(rpcUrl, "confirmed");
    const tree = new PublicKey("smt2rJAFdyJJupwMKAqTNAJwvjhmiZ4JYGZmbVRw1Ho");

    console.log(`Checking owner of tree: ${tree.toBase58()}`);
    const info = await connection.getAccountInfo(tree);
    if (info) {
        console.log(`Owner: ${info.owner.toBase58()}`);
    } else {
        console.log("Tree account not found.");
    }
}
main();
