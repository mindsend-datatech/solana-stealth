
import { PublicKey } from "@solana/web3.js";

const bytes = [253, 173, 249, 243, 128, 22, 100, 163, 100, 28, 49, 243, 187, 117, 98, 87, 47, 196, 136, 29, 184, 125, 77, 22, 202, 183, 13, 71, 112, 127, 169, 117];
const pubkey = new PublicKey(bytes);
console.log("Decoded Owner Pubkey:", pubkey.toBase58());
