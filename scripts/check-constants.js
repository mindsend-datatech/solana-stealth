
const stateless = require("@lightprotocol/stateless.js");
const token = require("@lightprotocol/compressed-token");

console.log("Stateless LightSystemProgram.programId:", stateless.LightSystemProgram.programId.toBase58());
console.log("Stateless COMPRESSED_TOKEN_PROGRAM_ID:", stateless.COMPRESSED_TOKEN_PROGRAM_ID ? stateless.COMPRESSED_TOKEN_PROGRAM_ID.toBase58() : "undefined");
console.log("Token COMPRESSED_TOKEN_PROGRAM_ID:", token.COMPRESSED_TOKEN_PROGRAM_ID ? token.COMPRESSED_TOKEN_PROGRAM_ID.toBase58() : "undefined");
// check if there is a CompressedSystemProgram
console.log("Stateless keys:", Object.keys(stateless));
