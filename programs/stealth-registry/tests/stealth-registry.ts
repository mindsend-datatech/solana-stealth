import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// import { StealthRegistry } from "../target/types/stealth_registry";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("stealth-registry", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // We are testing the deployed program on devnet, but we need the IDL to interact comfortably.
  // Since we don't have the workspace type loaded (it might be failing), we'll define the program ID manually
  // and try to fetch the program. Ideally we should use workspace if available.
  const programId = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

  // Note: For this test to run against devnet, Anchor.toml must be configured for devnet provider.
  // Or we can just use the workspace if we are running `anchor test`.
  // Let's assume the user runs this with `anchor test` and it uses the local workspace IDL
  // mapped to the devnet program ID if configured.

  // Since we might not have the IDL generated locally matching the one on chain perfectly if there's a mismatch,
  // we will trust the workspace loading.
  const program = anchor.workspace.StealthRegistry as Program<any>;

  it("Registers a new handle", async () => {
    const handle = "test_chk_" + Math.floor(Math.random() * 100000);
    const destinationKp = Keypair.generate();

    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stealth"), Buffer.from(handle)],
      program.programId
    );

    console.log("Registering handle:", handle);
    console.log("PDA:", registryPda.toBase58());

    const tx = await program.methods
      .register(handle, destinationKp.publicKey)
      .accounts({
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        registryEntry: registryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Transaction signature:", tx);

    // Verify account created
    const account = await program.account.registryEntry.fetch(registryPda);
    assert.equal(account.handle, handle);
    assert.isTrue(account.authority.equals(provider.wallet.publicKey));
    assert.isTrue(account.destinationPubkey.equals(destinationKp.publicKey));
  });

  it("Registers a new handle (Manual Construction)", async () => {
    const handle = "test_manual_" + Math.floor(Math.random() * 100000);
    const destinationKp = Keypair.generate();

    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stealth"), Buffer.from(handle)],
      program.programId
    );

    // Manual construction logic from page.tsx
    const REGISTER_DISCRIMINATOR = Buffer.from([211, 124, 67, 15, 211, 194, 178, 240]);
    const handleBytes = Buffer.from(handle);
    const handleLen = Buffer.alloc(4);
    handleLen.writeUInt32LE(handleBytes.length, 0);

    const instructionData = Buffer.concat([
      REGISTER_DISCRIMINATOR,
      handleLen,
      handleBytes,
      destinationKp.publicKey.toBuffer()
    ]);

    const keys = [
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: false }, // authority
      { pubkey: registryPda, isSigner: false, isWritable: true }, // registry_entry
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ];

    // COMPARE WITH ANCHOR
    try {
      const anchorIx = await program.methods
        .register(handle, destinationKp.publicKey)
        .accounts({
          payer: provider.wallet.publicKey,
          authority: provider.wallet.publicKey,
          registryEntry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      console.log("MANUAL Data:", instructionData.toString("hex"));
      console.log("ANCHOR Data:", anchorIx.data.toString("hex"));

      console.log("MANUAL Keys:", JSON.stringify(keys.map(k => ({ p: k.pubkey.toBase58(), s: k.isSigner, w: k.isWritable }))));
      console.log("ANCHOR Keys:", JSON.stringify(anchorIx.keys.map(k => ({ p: k.pubkey.toBase58(), s: k.isSigner, w: k.isWritable }))));

      if (instructionData.toString("hex") !== anchorIx.data.toString("hex")) {
        console.error("MISMATCH IN DATA");
      }

    } catch (e) {
      console.error("Error generating anchor instruction for comparison:", e);
    }

    const instruction = new anchor.web3.TransactionInstruction({
      programId: program.programId,
      keys: keys,
      data: instructionData,
    });

    const tx = new anchor.web3.Transaction().add(instruction);

    // Send using provider
    const sig = await provider.sendAndConfirm(tx);
    console.log("Manual Transaction signature:", sig);

    const account = await program.account.registryEntry.fetch(registryPda);
    assert.equal(account.handle, handle);
  });
});
