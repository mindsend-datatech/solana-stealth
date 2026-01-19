
import { sha256 } from "@noble/hashes/sha256";

function getDiscriminator(name: string): Buffer {
    const preimage = `global:${name}`;
    const hash = sha256(new TextEncoder().encode(preimage));
    return Buffer.from(hash.slice(0, 8));
}

console.log("Discriminators:");
console.log("decompress:", getDiscriminator("decompress").toString("hex"));
console.log("transfer:", getDiscriminator("transfer").toString("hex"));
console.log("compress:", getDiscriminator("compress").toString("hex"));
console.log("light_system:decompress:", getDiscriminator("light_system:decompress").toString("hex")); // Just in case
