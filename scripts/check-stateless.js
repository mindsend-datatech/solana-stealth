
const stateless = require("@lightprotocol/stateless.js");
const crypto = require('crypto');

console.log("Stateless LightSystemProgram.programId:", stateless.LightSystemProgram.programId.toBase58());
console.log("Stateless COMPRESSED_TOKEN_PROGRAM_ID:", stateless.COMPRESSED_TOKEN_PROGRAM_ID.toBase58());

// Calculate Anchor discriminators
function getDiscriminator(name) {
    const hash = crypto.createHash('sha256').update(name).digest();
    return hash.slice(0, 8).toString('hex');
}

console.log("Discriminators:");
console.log("global:decompress", getDiscriminator("global:decompress"));
console.log("global:compress", getDiscriminator("global:compress"));
console.log("light_system:decompress", getDiscriminator("light_system:decompress"));

