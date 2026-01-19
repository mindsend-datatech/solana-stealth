
const crypto = require('crypto');

function getDiscriminator(name) {
    const hash = crypto.createHash('sha256').update(name).digest();
    return hash.slice(0, 8).toString('hex');
}

console.log("global:invoke", getDiscriminator("global:invoke"));
console.log("invoke", getDiscriminator("invoke")); // not likely standard anchor
console.log("global:decompress", getDiscriminator("global:decompress"));

// The SDK generated 1a10a90715caf219
console.log("Check if 1a10a90715caf219 matches known names:");
// Try common names
const candidates = [
    "global:invoke", "global:execute", "global:process", "global:decompress", "global:compress",
    "light_system:invoke", "light_system:decompress"
];

candidates.forEach(c => {
    const d = getDiscriminator(c);
    if (d === "1a10a90715caf219") console.log(`MATCH! ${c} = ${d}`);
    else console.log(`${c} = ${d}`);
});
