const { PublicKey } = require("@solana/web3.js");
const crypto = require("crypto");

const programId = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");
const handle = "myname";

const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stealth"), Buffer.from(handle)],
    programId
);

console.log("PDA for 'myname':", pda.toBase58());

const discriminator = crypto.createHash("sha256").update("global:register").digest().slice(0, 8);
console.log("Discriminator (Hex):", discriminator.toString("hex"));

