import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { StealthRegistry } from "../target/types/stealth_registry";
import { assert, expect } from "chai";

describe("stealth-registry", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StealthRegistry as Program<StealthRegistry>;

  // Helper function to derive PDA for a handle
  const getRegistryPDA = async (handle: string): Promise<[PublicKey, number]> => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("stealth"), Buffer.from(handle)],
      program.programId
    );
  };

  describe("register", () => {
    it("successfully registers a valid handle", async () => {
      const handle = "alice";
      const [registryPDA] = await getRegistryPDA(handle);

      const tx = await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Fetch the created account
      const registryEntry = await program.account.registryEntry.fetch(registryPDA);

      assert.equal(registryEntry.handle, handle);
      assert.equal(registryEntry.authority.toBase58(), provider.wallet.publicKey.toBase58());
      assert.exists(registryEntry.bump);
    });

    it("successfully registers a handle with underscores", async () => {
      const handle = "test_user_123";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("successfully registers a handle with max length (32 chars)", async () => {
      const handle = "a".repeat(32); // 32 character handle
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
      assert.equal(registryEntry.handle.length, 32);
    });

    it("fails when handle is too long (> 32 chars)", async () => {
      const handle = "a".repeat(33); // 33 character handle - too long

      try {
        // PDA derivation will fail because Solana seeds have a 32-byte max
        const [registryPDA] = await getRegistryPDA(handle);

        await program.methods
          .register(handle, provider.wallet.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            registryEntry: registryPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        assert.fail("Expected error for handle too long");
      } catch (err: any) {
        // Client-side validation: Solana PDA seeds must be <= 32 bytes
        // This will throw "Max seed length exceeded" before hitting the program
        assert.exists(err);
        assert.isTrue(
          err.message?.includes("Max seed length exceeded") ||
          err.error?.errorMessage?.includes("Handle exceeds maximum length")
        );
      }
    });

    it("fails when handle is empty", async () => {
      const handle = "";
      const [registryPDA] = await getRegistryPDA(handle);

      try {
        await program.methods
          .register(handle, provider.wallet.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            registryEntry: registryPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        assert.fail("Expected error for empty handle");
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.include(anchorError.error.errorMessage, "Handle cannot be empty");
      }
    });

    it("fails when handle contains invalid characters", async () => {
      const invalidHandles = [
        "alice.bob",      // dot
        "alice-bob",      // hyphen
        "alice bob",      // space
        "alice@bob",      // special char
        "alice#123",      // hash
      ];

      for (const handle of invalidHandles) {
        const [registryPDA] = await getRegistryPDA(handle);

        try {
          await program.methods
            .register(handle, provider.wallet.publicKey)
            .accounts({
              authority: provider.wallet.publicKey,
              registryEntry: registryPDA,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

          assert.fail(`Expected error for invalid handle: ${handle}`);
        } catch (err) {
          const anchorError = err as AnchorError;
          assert.include(anchorError.error.errorMessage, "invalid characters");
        }
      }
    });

    it("fails when trying to register the same handle twice", async () => {
      const handle = "duplicate_test";
      const [registryPDA] = await getRegistryPDA(handle);

      // First registration should succeed
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Second registration should fail (account already exists)
      try {
        await program.methods
          .register(handle, provider.wallet.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            registryEntry: registryPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        assert.fail("Expected error for duplicate handle");
      } catch (err) {
        // Should fail because account already exists
        assert.exists(err);
      }
    });
  });

  describe("handle edge cases", () => {
    it("successfully registers single character handle", async () => {
      const handle = "a";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
      assert.equal(registryEntry.handle.length, 1);
    });

    it("successfully registers numeric-only handle", async () => {
      const handle = "123456789";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("successfully registers underscore-only handle", async () => {
      const handle = "___";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("successfully registers handle with leading underscore", async () => {
      const handle = "_alice";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("successfully registers handle with trailing underscore", async () => {
      const handle = "alice_";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("successfully registers uppercase handle", async () => {
      const handle = "ALICE";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("successfully registers mixed case handle", async () => {
      const handle = "AlIcE_BoB_123";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.handle, handle);
    });

    it("case sensitive handles are unique", async () => {
      // Use unique handles to avoid collision with other tests
      const handle1 = "casetest";
      const handle2 = "CASETEST";
      const [registryPDA1] = await getRegistryPDA(handle1);
      const [registryPDA2] = await getRegistryPDA(handle2);

      // Register lowercase
      await program.methods
        .register(handle1, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA1,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Register uppercase (should succeed - different PDA)
      await program.methods
        .register(handle2, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA2,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Verify both exist
      const entry1 = await program.account.registryEntry.fetch(registryPDA1);
      const entry2 = await program.account.registryEntry.fetch(registryPDA2);

      assert.equal(entry1.handle, handle1);
      assert.equal(entry2.handle, handle2);
      assert.notEqual(registryPDA1.toBase58(), registryPDA2.toBase58());
    });
  });

  describe("PDA and account structure", () => {
    it("PDA derivation is deterministic", async () => {
      const handle = "deterministic_test";
      const [pda1, bump1] = await getRegistryPDA(handle);
      const [pda2, bump2] = await getRegistryPDA(handle);

      assert.equal(pda1.toBase58(), pda2.toBase58());
      assert.equal(bump1, bump2);
    });

    it("different handles produce different PDAs", async () => {
      const handle1 = "alice_unique";
      const handle2 = "bob_unique";
      const [pda1] = await getRegistryPDA(handle1);
      const [pda2] = await getRegistryPDA(handle2);

      assert.notEqual(pda1.toBase58(), pda2.toBase58());
    });

    it("stores bump seed correctly", async () => {
      const handle = "bump_test";
      const [registryPDA, expectedBump] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.bump, expectedBump);
    });

    it("account data matches expected structure", async () => {
      const handle = "structure_test";
      const [registryPDA] = await getRegistryPDA(handle);

      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);

      // Verify all fields exist and have correct types
      assert.isString(registryEntry.handle);
      assert.exists(registryEntry.authority);
      assert.isNumber(registryEntry.bump);

      // Verify field values
      assert.equal(registryEntry.handle, handle);
      assert.equal(registryEntry.authority.toBase58(), provider.wallet.publicKey.toBase58());
      assert.isAtLeast(registryEntry.bump, 0);
      assert.isAtMost(registryEntry.bump, 255);
    });

    it("fails to fetch non-existent handle", async () => {
      const handle = "nonexistent_handle_xyz";
      const [registryPDA] = await getRegistryPDA(handle);

      try {
        await program.account.registryEntry.fetch(registryPDA);
        assert.fail("Expected error for non-existent account");
      } catch (err) {
        // Should throw error for account not found
        assert.exists(err);
      }
    });
  });

  describe("update_authority", () => {
    it("successfully updates authority to a new owner", async () => {
      const handle = "transfer_test";
      const newOwner = Keypair.generate();
      const [registryPDA] = await getRegistryPDA(handle);

      // First, register the handle
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Verify initial ownership
      let registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.authority.toBase58(), provider.wallet.publicKey.toBase58());

      // Update authority
      await program.methods
        .updateAuthority(handle, newOwner.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      // Verify new ownership
      registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.authority.toBase58(), newOwner.publicKey.toBase58());
    });

    it("fails when non-authority tries to update", async () => {
      const handle = "unauthorized_test";
      const unauthorizedUser = Keypair.generate();
      const newOwner = Keypair.generate();
      const [registryPDA] = await getRegistryPDA(handle);

      // Register handle with provider wallet
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Airdrop some SOL to unauthorized user for transaction fees
      const airdropSig = await provider.connection.requestAirdrop(
        unauthorizedUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      // Try to update authority as unauthorized user
      try {
        await program.methods
          .updateAuthority(handle, newOwner.publicKey)
          .accounts({
            registryEntry: registryPDA,
            authority: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();

        assert.fail("Expected error for unauthorized update");
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.include(anchorError.error.errorMessage, "not authorized");
      }
    });

    it("new authority can further transfer ownership", async () => {
      const handle = "chain_transfer";
      const secondOwner = Keypair.generate();
      const thirdOwner = Keypair.generate();
      const [registryPDA] = await getRegistryPDA(handle);

      // Airdrop SOL to second owner
      const airdropSig = await provider.connection.requestAirdrop(
        secondOwner.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      // Register handle
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // First transfer: provider -> second owner
      await program.methods
        .updateAuthority(handle, secondOwner.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      let registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.authority.toBase58(), secondOwner.publicKey.toBase58());

      // Second transfer: second owner -> third owner
      await program.methods
        .updateAuthority(handle, thirdOwner.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: secondOwner.publicKey,
        })
        .signers([secondOwner])
        .rpc();

      registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.authority.toBase58(), thirdOwner.publicKey.toBase58());
    });

    it("old authority cannot update after transfer", async () => {
      const handle = "old_auth_test";
      const newOwner = Keypair.generate();
      const anotherOwner = Keypair.generate();
      const [registryPDA] = await getRegistryPDA(handle);

      // Register handle
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Transfer to new owner
      await program.methods
        .updateAuthority(handle, newOwner.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      // Old authority (provider) tries to transfer again
      try {
        await program.methods
          .updateAuthority(handle, anotherOwner.publicKey)
          .accounts({
            registryEntry: registryPDA,
            authority: provider.wallet.publicKey,
          })
          .rpc();

        assert.fail("Expected error for old authority trying to update");
      } catch (err) {
        const anchorError = err as AnchorError;
        assert.include(anchorError.error.errorMessage, "not authorized");
      }
    });

    it("can transfer to same address (no-op)", async () => {
      const handle = "self_transfer";
      const [registryPDA] = await getRegistryPDA(handle);

      // Register handle
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Transfer to self
      await program.methods
        .updateAuthority(handle, provider.wallet.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      const registryEntry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(registryEntry.authority.toBase58(), provider.wallet.publicKey.toBase58());
    });
  });

  describe("integration workflows", () => {
    it("same authority can register multiple handles", async () => {
      const handles = ["alice_multi", "bob_multi", "charlie_multi"];
      const pdas: PublicKey[] = [];

      // Register all handles
      for (const handle of handles) {
        const [registryPDA] = await getRegistryPDA(handle);
        pdas.push(registryPDA);

        await program.methods
          .register(handle, provider.wallet.publicKey)
          .accounts({
            authority: provider.wallet.publicKey,
            registryEntry: registryPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
      }

      // Verify all registrations
      for (let i = 0; i < handles.length; i++) {
        const registryEntry = await program.account.registryEntry.fetch(pdas[i]);
        assert.equal(registryEntry.handle, handles[i]);
        assert.equal(registryEntry.authority.toBase58(), provider.wallet.publicKey.toBase58());
      }
    });

    it("complex transfer scenario with multiple parties", async () => {
      const handle = "complex_transfer";
      const user1 = Keypair.generate();
      const user2 = Keypair.generate();
      const user3 = Keypair.generate();
      const [registryPDA] = await getRegistryPDA(handle);

      // Airdrop to all users
      for (const user of [user1, user2, user3]) {
        const airdropSig = await provider.connection.requestAirdrop(
          user.publicKey,
          2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropSig);
      }

      // Provider registers
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Transfer: provider -> user1
      await program.methods
        .updateAuthority(handle, user1.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      let entry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(entry.authority.toBase58(), user1.publicKey.toBase58());

      // Transfer: user1 -> user2
      await program.methods
        .updateAuthority(handle, user2.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      entry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(entry.authority.toBase58(), user2.publicKey.toBase58());

      // Transfer: user2 -> user3
      await program.methods
        .updateAuthority(handle, user3.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: user2.publicKey,
        })
        .signers([user2])
        .rpc();

      entry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(entry.authority.toBase58(), user3.publicKey.toBase58());

      // Transfer: user3 -> back to provider
      await program.methods
        .updateAuthority(handle, provider.wallet.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: user3.publicKey,
        })
        .signers([user3])
        .rpc();

      entry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(entry.authority.toBase58(), provider.wallet.publicKey.toBase58());
    });

    it("handle lifecycle: register, transfer, verify immutability of handle", async () => {
      const handle = "immutable_test";
      const newOwner = Keypair.generate();
      const [registryPDA] = await getRegistryPDA(handle);

      // Register
      await program.methods
        .register(handle, provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          registryEntry: registryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      let entry = await program.account.registryEntry.fetch(registryPDA);
      const originalHandle = entry.handle;

      // Transfer authority
      await program.methods
        .updateAuthority(handle, newOwner.publicKey)
        .accounts({
          registryEntry: registryPDA,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      // Verify handle didn't change
      entry = await program.account.registryEntry.fetch(registryPDA);
      assert.equal(entry.handle, originalHandle);
      assert.equal(entry.handle, handle);
      assert.equal(entry.authority.toBase58(), newOwner.publicKey.toBase58());
    });
  });
});
