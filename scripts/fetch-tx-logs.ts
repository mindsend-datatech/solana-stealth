
import { Connection } from "@solana/web3.js";

const TX_SIG = "1AvzkM9NLitHu9TAUjm9p2vvo45VBXTRLzuuxgj1tZkSYve49yPjKCGMaz3bx3VCsLF3vM6LSMCCqkCrtFps8i2";
const RPC_URL = "https://api.devnet.solana.com";

async function main() {
    const connection = new Connection(RPC_URL, "confirmed");
    console.log(`Fetching transaction ${TX_SIG}...`);

    const tx = await connection.getTransaction(TX_SIG, {
        maxSupportedTransactionVersion: 0
    });

    if (!tx) {
        console.log("Transaction not found or confirmed yet.");
        return;
    }

    if (tx.meta?.err) {
        console.log("Transaction Failed!");
        console.log("Error:", JSON.stringify(tx.meta.err, null, 2));
        console.log("Logs:");
        tx.meta.logMessages?.forEach(log => console.log(log));
    } else {
        console.log("Transaction Successful!");
    }
}

main().catch(console.error);
