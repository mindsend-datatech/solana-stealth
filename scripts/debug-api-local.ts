
import { POST } from "../app/api/actions/donate/[username]/route";
import { PublicKey, Transaction } from "@solana/web3.js";

// Mock Request
class MockRequest {
    url: string;
    method: string;
    body: any;

    constructor(url: string, body: any) {
        this.url = url;
        this.method = "POST";
        this.body = body;
    }

    async json() {
        return this.body;
    }
}

async function main() {
    console.log("🧪 Debugging API POST Logic Local Simulation...");

    const username = "BmKjSaoeHB89jDaDFyDKfh4next9RJSWKoKbGQawojkG"; // The recipient from the user's TX
    const account = "J5G1m8dBysdfxx9ek16b7G5gnKdzQNwQNK4vwEWat1Ti"; // The payer from the user's TX

    const req = new MockRequest(
        `http://localhost:3000/api/actions/donate/${username}?amount=0.01`,
        { account: account }
    );

    // Call the API handler directly
    // @ts-ignore
    const response = await POST(req, { params: Promise.resolve({ username }) });

    if (!response.ok) {
        console.error("❌ API Response Error:", response.status);
        console.error(await response.json());
        return;
    }

    const data = await response.json();
    console.log("✅ API Response OK");
    console.log("Message:", data.message);

    if (data.transaction) {
        console.log("\n📦 Decoding Transaction...");
        const txBuffer = Buffer.from(data.transaction, "base64");
        const tx = Transaction.from(txBuffer);

        console.log("   - Instructions:", tx.instructions.length);
        tx.instructions.forEach((ix, i) => {
            console.log(`\n   [Instruction ${i}]`);
            console.log(`   - ProgramId: ${ix.programId.toBase58()}`);

            // Check for known programs
            if (ix.programId.toBase58() === "11111111111111111111111111111111") console.log("     -> System Program");
            if (ix.programId.toBase58() === "LbVRzDTvBDEcrthqnz4FTk9irWdfLgnX7tQhF8q4A8i") console.log("     -> Light Protocol (Likely)");
            // Note: Light Protocol statless program ID might vary on devnet, but usually starts with 'L'.
            // The SDK uses: Can be checked via LightSystemProgram.programId
        });
    } else {
        console.error("❌ No transaction returned in payload!");
    }
}

main();
