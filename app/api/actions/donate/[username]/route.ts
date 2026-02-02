
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

// Helper function to truncate public key for display
function truncatePubkey(pubkey: string): string {
    if (pubkey.length <= 10) return pubkey;
    return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params;

    let title = `Donate Privately`;
    let description = `Support this creator with a shielded donation. Your funds will be compressed into a private UTXO. Privacy by Default.`;

    if (username.toLowerCase().endsWith(".sol") || username.toLowerCase().endsWith(".stealth")) {
        title = `Donate Privately to ${username} (Secure v2)`;
        description = `Support this creator with a shielded donation. Your funds will be compressed into a private UTXO owned by ${username}. Privacy by Default.`;
    } else {
        try {
            new PublicKey(username);
            const truncated = truncatePubkey(username);
            title = `Donate Privately to ${truncated} (Secure v2)`;
            description = `Support this creator with a shielded donation. Your funds will be compressed into a private UTXO owned by ${username}. Privacy by Default.`;
        } catch {
            title = "Invalid Creator Address";
        }
    }

    const payload: ActionGetResponse = {
        title,
        icon: new URL("/stealth-icon.png", request.url).toString(),
        description,
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
        const amountSOL = parseFloat(amountStr);
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
            } catch (_e) {
                console.error(`Failed to resolve .sol domain ${username}:`, _e);
                return Response.json({ error: `Could not resolve .sol domain: ${username}` }, { status: 400, headers: ACTIONS_CORS_HEADERS });
            }
        } else if (username.toLowerCase().endsWith(".stealth")) {
            // --- Custom Registry Resolution (.stealth) ---
            try {
                const handle = username.slice(0, -8); // remove .stealth
                const PROGRAM_ID = new PublicKey("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

                // Derive PDA: [b"stealth", handle.as_bytes()]
                const [pda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("stealth"), Buffer.from(handle)],
                    PROGRAM_ID
                );

                const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
                // Use a standard connection for fetching account info
                const connection = new Connection(rpcUrl || "https://api.devnet.solana.com", "confirmed");

                const accountInfo = await connection.getAccountInfo(pda);
                if (!accountInfo) {
                    throw new Error(`Handle ${username} not registered.`);
                }

                // Deserialization (Manual)
                // Layout: [8 byte disc] + [4 byte len] + [handle bytes] + [32 byte authority] + [32 byte destination] + [1 byte bump]

                const handleLen = accountInfo.data.readUInt32LE(8);
                const authorityOffset = 8 + 4 + handleLen;
                const destinationOffset = authorityOffset + 32;

                // Ensure data is long enough
                if (accountInfo.data.length < destinationOffset + 32) {
                    // Fallback for legacy accounts (if any) or error
                    // Since we just updated the program, old accounts might not have this field.
                    // But for this "fix", we assume we are using the new program logic.
                    // If missing, fallback to authority? No, better to fail fast or default to authority if we want backward compat.
                    // Let's fallback to authority to prevent breakage of old accounts if possible, 
                    // though realistically we should migrate them or expect new registrations.
                    console.warn(`[Stealth Registry] Account too short for separate destination key, falling back to authority.`);
                    const authorityBytes = accountInfo.data.subarray(authorityOffset, authorityOffset + 32);
                    recipientPubkey = new PublicKey(authorityBytes);
                } else {
                    const destinationBytes = accountInfo.data.subarray(destinationOffset, destinationOffset + 32);
                    recipientPubkey = new PublicKey(destinationBytes);
                }

                console.log(`Resolved ${username} -> ${recipientPubkey.toBase58()} (from Stealth Registry)`);

            } catch (_e) {
                console.error(`Failed to resolve .stealth domain ${username}:`, _e);
                return Response.json({ error: `Could not resolve .stealth domain: ${username}. Ensure it is registered.` }, { status: 400, headers: ACTIONS_CORS_HEADERS });
            }
        } else {
            // Standard Public Key
            try {
                recipientPubkey = new PublicKey(username);
            } catch {
                return Response.json({ error: "Invalid Creator Address: Must be a Solana Public Key, .sol, or .stealth domain" }, { status: 400, headers: ACTIONS_CORS_HEADERS });
            }
        }

        console.log(`Preparing shield tx: User ${account.toBase58()} -> Creator ${recipientPubkey.toBase58()} (${amountSOL} SOL)`);

        const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
        if (!rpcUrl) {
            return Response.json({ error: "Server Configuration Error: Missing RPC URL" }, { status: 500, headers: ACTIONS_CORS_HEADERS });
        }

        const connection = new Connection(rpcUrl, "confirmed");
        const transaction = new Transaction();

        // --- Light Protocol Shielding ---
        try {
            const rpc = createRpc(rpcUrl, rpcUrl);
            const stateTrees = await rpc.getStateTreeInfos();

            // Log ALL available trees for debugging
            console.log(`[Donate] Found ${stateTrees.length} state trees:`);
            stateTrees.forEach((t, i) => {
                console.log(`  [${i}] Tree: ${t.tree.toBase58()}, Queue: ${t.queue.toBase58()}, Type: ${t.treeType}`);
            });

            if (stateTrees.length === 0) {
                throw new Error("No state trees found on RPC.");
            }

            // Select a V1 tree by treeType (treeType: 1 = StateV1)
            // NOTE: The tree address name (smt1, smt2, etc) is just a hash, not the tree version!
            // IMPORTANT: Only V1 trees are compatible with our unshield flow - do NOT fallback to V2
            const outputStateTree = stateTrees.find(t => t.treeType === 1);

            if (!outputStateTree) {
                // Fail explicitly rather than use incompatible V2 tree
                console.error("No V1 state tree available - cannot shield funds safely");
                return Response.json({
                    error: "No compatible state trees available for shielding. Please try again later."
                }, { status: 503, headers: ACTIONS_CORS_HEADERS });
            }

            console.log(`[Donate] Using state tree: ${outputStateTree.tree.toBase58()}, type: ${outputStateTree.treeType}`);

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
                message: `Shielding ${amountSOL} SOL to private UTXO 🥷`,
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
