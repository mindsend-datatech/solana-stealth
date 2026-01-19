
const stateless = require("@lightprotocol/stateless.js");
const fs = require('fs');

const idl = stateless.IDL;
console.log("IDL Instructions:", idl.instructions.map(ix => ix.name));

// If instructions have discriminators in IDL (rare for standard IDL json, but let's check structure)
console.log("First Instruction:", JSON.stringify(idl.instructions[0], null, 2));
