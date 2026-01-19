
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import { LightSystemProgram, createRpc } from "@lightprotocol/stateless.js";
import BN from "bn.js";

async function main() {
  console.log("Starting Light Protocol Shield Verification (Attempt 2)...");

  // 1. Setup Connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // 2. Setup Payer (Donor)
  const payer = Keypair.generate();
  console.log("Payer Address:", payer.publicKey.toBase58());

  // Airdrop
  console.log("Requesting Airdrop...");
  try {
    const signature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    console.log("Airdrop confirmed.");
  } catch (e) {
    console.error("Airdrop failed. Ensure payer has funds:", (e as any).message);
  }

  // 3. Setup Recipient (Creator)
  const recipient = Keypair.generate();
  console.log("Recipient Address:", recipient.publicKey.toBase58());

  // 4. Build Compress (Shield) Transaction
  const amountToShield = new BN(100_000_000); // 0.1 SOL

  console.log("Creating Compress Instruction...");
  try {
    // Attempting to use 'compress' based on inspection
    // Guessing keys: payer, toAddress, lamports
    // Use Helius RPC for Light Protocol
    const rpcUrl = "https://devnet.helius-rpc.com/?api-key=69ce5e56-f9a6-409d-9155-bfc8f799c172"; // Using the key from .env.local output earlier
    const rpc = createRpc(rpcUrl, rpcUrl);
    const stateTrees = await rpc.getStateTreeInfos();

    console.log(`Found ${stateTrees.length} trees.`);
    // Filter for State Trees (TreeType.StateV1 = 1, TreeType.StateV2 = 3)
    // We want the State Tree, not Access/Address trees.
    // For now, let's look for type 3 (V2) or 1 (V1).
    const outputStateTree = stateTrees.find(t => t.treeType === 3 || t.treeType === 1);

    if (!outputStateTree) {
      // Log all types to debug
      stateTrees.forEach(t => console.log("Tree:", t.tree.toBase58(), "Type:", t.treeType));
      throw new Error("No valid State Tree found.");
    }

    console.log(`Using State Tree: ${outputStateTree.tree.toBase58()} (Type: ${outputStateTree.treeType})`);

    const ix = await LightSystemProgram.compress({
      payer: payer.publicKey,
      toAddress: recipient.publicKey,
      lamports: amountToShield,
      outputStateTreeInfo: outputStateTree,
    });

    const transaction = new Transaction().add(ix);
    transaction.feePayer = payer.publicKey;
    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;

    console.log("Sending Transaction...");
    const txSig = await sendAndConfirmTransaction(connection, transaction, [payer]);

    console.log("✅ Compress (Shield) Transaction Confirmed:", txSig);
    console.log("https://explorer.solana.com/tx/" + txSig + "?cluster=devnet");
    console.log("This confirms we can shield SOL directly to a third-party recipient!");

  } catch (err) {
    console.error("❌ Compress failed:", err);
  }
}

main().catch(console.error);
