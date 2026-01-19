
import { LightSystemProgram, Rpc } from "@lightprotocol/stateless.js";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
    const owner = new PublicKey("11111111111111111111111111111111");
    // Mock input structure
    const inputs = [{
        lamports: new BN(100),
        hash: new BN(1),
        treeInfo: {
            tree: owner,
            queue: owner,
            treeType: 1
        },
        // Add other req fields if needed by SDK mock
        programId: owner,
        leafIndex: 0,
        readOnly: false
    }];

    try {
        const ix = await LightSystemProgram.decompress({
            payer: owner,
            inputCompressedAccounts: inputs as any,
            toAddress: owner,
            lamports: new BN(100),
            recentValidityProof: {
                a: [0], b: [[0, 0], [0, 0]], c: [0]
            } as any,
            recentInputStateRootIndices: [0]
        });

        console.log("Generated Discriminator (First 8 bytes):", ix.data.slice(0, 8).toString('hex'));
        console.log("Target Program ID:", ix.programId.toBase58());
    } catch (e) {
        console.error(e);
    }
}
main();
