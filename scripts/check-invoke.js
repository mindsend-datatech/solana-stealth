
const stateless = require("@lightprotocol/stateless.js");

console.log("INVOKE_DISCRIMINATOR:", Buffer.from(stateless.INVOKE_DISCRIMINATOR).toString('hex'));
console.log("INVOKE_CPI_DISCRIMINATOR:", Buffer.from(stateless.INVOKE_CPI_DISCRIMINATOR).toString('hex'));

if (stateless.InstructionDataInvokeLayout) {
    console.log("InstructionDataInvokeLayout span:", stateless.InstructionDataInvokeLayout.span);
}
