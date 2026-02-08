// ──────────────────────────────────────────────
// Yellow Network (State Channels via ClearNet)
// Uses @erc7824/nitrolite SDK
// ──────────────────────────────────────────────
import {
  NitroliteClient,
  type Channel,
  type Allocation,
} from "@erc7824/nitrolite";
import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Hex,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  YELLOW_CONTRACTS,
  YELLOW_CHAIN_ID,
  YELLOW_TEST_TOKEN,
  YELLOW_TEST_TOKEN_ADDRESS,
} from "../config/constants.js";

// Derived constants
const YELLOW_WS_URL = "wss://clearnet-sandbox.yellow.com/ws";
const YELLOW_CUSTODY_ADDRESS = YELLOW_CONTRACTS.custody;
const YELLOW_ADJUDICATOR_ADDRESS = YELLOW_CONTRACTS.adjudicator;
const YELLOW_TOKEN = YELLOW_TEST_TOKEN_ADDRESS; // use hex address for Allocation

// ── Module state ──────────────────────────────

let nitroClient: NitroliteClient | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let walletClient: any = null;
let publicClient: PublicClient | null = null;
let ws: WebSocket | null = null;
let serverAccount: ReturnType<typeof privateKeyToAccount> | null = null;

// ── Initialization ────────────────────────────

export async function initYellow(): Promise<void> {
  const pk = process.env.YELLOW_PRIVATE_KEY;
  if (!pk) {
    console.warn("⚠️  Yellow: YELLOW_PRIVATE_KEY not set. State channels disabled.");
    return;
  }

  serverAccount = privateKeyToAccount(pk as Hex);
  console.log(`🟡 Yellow: Server wallet = ${serverAccount.address}`);

  publicClient = createPublicClient({ chain: sepolia, transport: http() });
  walletClient = createWalletClient({
    account: serverAccount,
    chain: sepolia,
    transport: http(),
  });

  // Create Nitrolite client
  nitroClient = new NitroliteClient({
    publicClient,
    walletClient,
    addresses: {
      custody: YELLOW_CUSTODY_ADDRESS as `0x${string}`,
      adjudicator: YELLOW_ADJUDICATOR_ADDRESS as `0x${string}`,
      guestAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    },
    chainId: YELLOW_CHAIN_ID,
    challengeDuration: BigInt(86400), // 1 day
  });

  // Open ClearNode WebSocket
  ws = new WebSocket(YELLOW_WS_URL);

  ws.onopen = () => {
    console.log("🟡 Yellow: ClearNode WebSocket connected");
  };

  ws.onclose = () => {
    console.log("🟡 Yellow: ClearNode WebSocket closed");
  };

  ws.onerror = (err) => {
    console.error("🟡 Yellow: ClearNode WS error", err);
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data.toString());
      handleClearNodeMessage(data);
    } catch {
      // Non-JSON message
    }
  };
}

// ── ClearNode message handler ─────────────────

function handleClearNodeMessage(data: Record<string, unknown>) {
  // Handle incoming ClearNode messages (channel updates, challenges, etc.)
  const method = data.method as string | undefined;
  if (!method) return;

  switch (method) {
    case "channel_proposed":
      console.log("🟡 Yellow: Channel proposed", data);
      break;
    case "channel_updated":
      console.log("🟡 Yellow: Channel updated", data);
      break;
    case "channel_closed":
      console.log("🟡 Yellow: Channel closed", data);
      break;
    default:
      console.log("🟡 Yellow: Unknown method", method);
  }
}

// ── Channel operations ────────────────────────

/**
 * Authenticate with ClearNode using EIP-712 challenge-response
 */
export async function authenticateWithClearNode(): Promise<boolean> {
  if (!ws || !serverAccount) {
    console.warn("Yellow: Not initialized");
    return false;
  }

  try {
    // Request auth challenge
    const challengeRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "auth_challenge",
      params: { address: serverAccount.address },
    };
    ws.send(JSON.stringify(challengeRequest));
    console.log("🟡 Yellow: Auth challenge sent");
    return true;
  } catch (err) {
    console.error("🟡 Yellow: Auth failed", err);
    return false;
  }
}

/**
 * Open a virtual payment channel for a streaming session
 */
export async function openChannel(
  userAddress: string,
  initialBeats: number
): Promise<{ channelId: string } | null> {
  if (!ws || !nitroClient || !serverAccount) {
    console.warn("Yellow: Not initialized");
    return null;
  }

  try {
    const allocations: Allocation[] = [
      {
        destination: userAddress as `0x${string}`,
        token: YELLOW_TOKEN,
        amount: BigInt(initialBeats),
      },
      {
        destination: serverAccount.address,
        token: YELLOW_TOKEN,
        amount: BigInt(0),
      },
    ];

    // Request channel creation via ClearNode
    const createRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "create_channel",
      params: {
        participants: [userAddress, serverAccount.address],
        allocations,
        token: YELLOW_TOKEN,
      },
    };

    ws.send(JSON.stringify(createRequest));

    // In production, we'd wait for confirmation via onmessage handler
    // For hackathon, return a mock channel ID
    const channelId = `ch-${Date.now()}-${userAddress.slice(2, 8)}`;
    console.log(`🟡 Yellow: Channel requested → ${channelId}`);
    return { channelId };
  } catch (err) {
    console.error("🟡 Yellow: openChannel error", err);
    return null;
  }
}

/**
 * Update channel allocation (move 1 beat from user to server per second)
 */
export async function updateChannelState(
  channelId: string,
  userAddress: string,
  userBeats: number,
  serverBeats: number
): Promise<boolean> {
  if (!ws || !serverAccount) return false;

  try {
    const updateRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "update_channel",
      params: {
        channel_id: channelId,
        allocations: [
          {
            destination: userAddress,
            token: YELLOW_TOKEN,
            amount: String(userBeats),
          },
          {
            destination: serverAccount.address,
            token: YELLOW_TOKEN,
            amount: String(serverBeats),
          },
        ],
      },
    };

    ws.send(JSON.stringify(updateRequest));
    return true;
  } catch (err) {
    console.error("🟡 Yellow: updateChannelState error", err);
    return false;
  }
}

/**
 * Close channel and settle on-chain
 */
export async function closeChannel(channelId: string): Promise<boolean> {
  if (!ws) return false;

  try {
    const closeRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "close_channel",
      params: { channel_id: channelId },
    };

    ws.send(JSON.stringify(closeRequest));
    console.log(`🟡 Yellow: Close requested for ${channelId}`);
    return true;
  } catch (err) {
    console.error("🟡 Yellow: closeChannel error", err);
    return false;
  }
}

// ── Helpers ───────────────────────────────────

export function getYellowStatus(): {
  connected: boolean;
  address: string | null;
} {
  return {
    connected: ws?.readyState === WebSocket.OPEN,
    address: serverAccount?.address ?? null,
  };
}
