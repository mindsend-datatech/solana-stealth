
import {
    ActionGetResponse,
    ActionPostRequest,
    ActionPostResponse,
    ACTIONS_CORS_HEADERS,
    createPostResponse,
} from "@solana/actions";
import {
    Connection,
    PublicKey,
    Transaction,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { LightSystemProgram, createRpc } from "@lightprotocol/stateless.js";
import BN from "bn.js";

// Force dynamic since we use params
export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    let title = `Donate Privately`;
    if (username.endsWith(".sol")) {
        title = `Donate Privately to ${username} (Secure v2)`;
    } else {
        try {
            new PublicKey(username);
            title = `Donate Privately to ${username.slice(0, 4)}...${username.slice(-4)} (Secure v2)`;
        } catch {
            title = "Invalid Creator Address";
        }
    }

    const payload: ActionGetResponse = {
        title,
        icon: new URL("/stealth-icon.png", request.url).toString(),
        description: `Support this creator with a shielded donation. Your funds will be compressed into a private UTXO owned by ${username}. Privacy by Default.`,
        label: "Donate 0.1 SOL",
        links: {
            actions: [
                {
                    type: "transaction",
                    label: "Donate 0.1 SOL",
                    href: `/api/actions/donate/${username}?amount=0.1&v=2`,
                },
                {
                    type: "transaction",
                    label: "Donate 0.5 SOL",
                    href: `/api/actions/donate/${username}?amount=0.5&v=2`,
                },
                {
                    type: "transaction",
                    label: "Donate Custom Amount",
                    href: `/api/actions/donate/${username}?amount={amount}&v=2`,
                    parameters: [
                        {
                            name: "amount",
                            label: "Enter amount (SOL)",
                            required: true,
                        }
                    ]
                }
            ]
        }
    };

    return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
    });
}

export const OPTIONS = GET;

export async function POST(
    request: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    try {
        const body: ActionPostRequest = await request.json();
        const url = new URL(request.url);
        const amountStr = url.searchParams.get("amount") || "0.1";

        // Validate amount
        let amountSOL = parseFloat(amountStr);
        if (isNaN(amountSOL) || amountSOL <= 0) {
            return Response.json({ error: "Invalid amount" }, { status: 400, headers: ACTIONS_CORS_HEADERS });
        }

        const account = new PublicKey(body.account);
        const amountLamports = new BN(amountSOL * LAMPORTS_PER_SOL);

        // Resolve Recipient
        // Logic: Checks if 'username' ends with .sol -> Resolve via SNS. Else -> Treat as PubKey.
        let recipientPubkey: PublicKey;

        if (username.toLowerCase().endsWith(".sol")) {
            try {
                const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
                const connection = new Connection(rpcUrl || "https://api.mainnet-beta.solana.com"); // Fallback to mainnet for resolution

                // Dynamically import to avoid build-time issues if package is missing types
                const { getDomainKeySync, NameRegistryState } = await import("@bonfida/spl-name-service");

                const { pubkey: domainKey } = getDomainKeySync(username);
                const { registry } = await NameRegistryState.retrieve(connection, domainKey);

                if (!registry.owner) {
                    throw new Error("Domain has no owner");
                }
                recipientPubkey = registry.owner;
                console.log(`Resolved ${username} -> ${recipientPubkey.toBase58()}`);
            } catch (e) {
                console.error(`Failed to resolve .sol domain ${username}:`, e);
                return Response.json({ error: `Could not resolve .sol domain: ${username}` }, { status: 400, headers: ACTIONS_CORS_HEADERS });
            }
        } else {
            // Standard Public Key
            try {
                recipientPubkey = new PublicKey(username);
            } catch (e) {
                return Response.json({ error: "Invalid Creator Address: Must be a Solana Public Key or .sol domain" }, { status: 400, headers: ACTIONS_CORS_HEADERS });
            }
        }

        console.log(`Preparing shield tx: User ${account.toBase58()} -> Creator ${recipientPubkey.toBase58()} (${amountSOL} SOL)`);

        const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
        if (!rpcUrl) {
            return Response.json({ error: "Server Configuration Error: Missing RPC URL" }, { status: 500, headers: ACTIONS_CORS_HEADERS });
        }

        const connection = new Connection(rpcUrl, "confirmed");
        let transaction = new Transaction();

        // --- Light Protocol Shielding ---
        try {
            const rpc = createRpc(rpcUrl, rpcUrl);
            const stateTrees = await rpc.getStateTreeInfos();
            if (stateTrees.length === 0) {
                throw new Error("No state trees found on RPC.");
            }

            // Filter for State Trees (TreeType.StateV1 = 1, TreeType.StateV2 = 3)
            // Just like in our verification script
            const outputStateTree = stateTrees.find(t => t.treeType === 3 || t.treeType === 1);

            if (!outputStateTree) {
                throw new Error("No valid State Tree found (Types 1 or 3).");
            }

            // Generate compress instruction
            const ix = await LightSystemProgram.compress({
                payer: account,
                toAddress: recipientPubkey,
                lamports: amountLamports, // BN
                outputStateTreeInfo: outputStateTree,
            });

            transaction.add(ix);

        } catch (e) {
            console.error("Light Protocol Error:", e);
            return Response.json({ error: "Failed to generate shielding transaction. Ensure RPC supports ZK compression." }, { status: 500, headers: ACTIONS_CORS_HEADERS });
        }

        transaction.feePayer = account;
        const blockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash.blockhash;

        const payload: ActionPostResponse = await createPostResponse({
            fields: {
                type: 'transaction',
                transaction,
                message: `Shielding ${amountSOL} SOL to ${username.slice(0, 4)}... 🥷`,
            },
        });

        return Response.json(payload, {
            headers: ACTIONS_CORS_HEADERS,
        });

    } catch (err) {
        console.error(err);
        return Response.json(
            { error: "An unknown error occurred" },
            { status: 500, headers: ACTIONS_CORS_HEADERS }
        );
    }
}
