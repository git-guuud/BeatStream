// ──────────────────────────────────────────────
// Yellow Network (State Channels via ClearNode)
// Uses @erc7824/nitrolite SDK v0.5.x
//
// Flow:
//   1. Server connects to ClearNode WebSocket
//   2. Authenticates with session key + EIP-712 challenge
//   3. Opens app sessions for streaming (user <-> server)
//   4. Submits state updates every second (beat ticks)
//   5. Closes app session on stream end -> triggers settlement
// ──────────────────────────────────────────────
import {
  NitroliteClient,
  WalletStateSigner,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  parseAuthChallengeResponse,
  parseAnyRPCResponse,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createAppSessionMessage,
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,
  createGetChannelsMessage,
  createCloseChannelMessage,
  createPingMessage,
  type MessageSigner,
  type AuthRequestParams,
  type RPCAppDefinition,
  RPCMethod,
  RPCChannelStatus,
  RPCProtocolVersion,
} from "@erc7824/nitrolite";
import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";
import WebSocket from "ws";
import {
  YELLOW_CONTRACTS,
  YELLOW_CHAIN_ID,
  YELLOW_WS_URL,
  YELLOW_TEST_TOKEN_ASSET,
  BEATSTREAM_APP_NAME,
} from "../config/constants.js";

// ── Module state ──────────────────────────────

let nitroClient: NitroliteClient | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let walletClient: any = null;
let publicClient: PublicClient | null = null;
let ws: WebSocket | null = null;
let serverAccount: ReturnType<typeof privateKeyToAccount> | null = null;

// Session key (temporary, rotated per server restart)
let sessionSigner: MessageSigner | null = null;
let sessionAccount: ReturnType<typeof privateKeyToAccount> | null = null;

let authenticated = false;

// Pending promise resolvers for request-response pattern
const pendingRequests = new Map<
  number,
  { resolve: (data: unknown) => void; reject: (err: Error) => void }
>();

// Active app sessions: beatstreamSessionId -> Yellow appSessionId
const activeAppSessions = new Map<string, Hex>();

// ── Initialization ────────────────────────────

export async function initYellow(): Promise<void> {
  const pk = process.env.YELLOW_PRIVATE_KEY;
  if (!pk) {
    console.warn(
      "⚠️  Yellow: YELLOW_PRIVATE_KEY not set. State channels disabled."
    );
    return;
  }

  serverAccount = privateKeyToAccount(pk as Hex);
  console.log(`🟡 Yellow: Server wallet = ${serverAccount.address}`);

  publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.ALCHEMY_RPC_URL),
  });

  walletClient = createWalletClient({
    account: serverAccount,
    chain: sepolia,
    transport: http(process.env.ALCHEMY_RPC_URL),
  });

  // NitroliteClient for on-chain operations (channel create, close, resize)
  nitroClient = new NitroliteClient({
    publicClient,
    walletClient,
    stateSigner: new WalletStateSigner(walletClient),
    addresses: {
      custody: YELLOW_CONTRACTS.custody as Address,
      adjudicator: YELLOW_CONTRACTS.adjudicator as Address,
    },
    chainId: YELLOW_CHAIN_ID,
    challengeDuration: BigInt(3600),
  });

  // Generate temporary session key for signing off-chain messages
  const sessionPrivateKey = generatePrivateKey();
  sessionSigner = createECDSAMessageSigner(sessionPrivateKey);
  sessionAccount = privateKeyToAccount(sessionPrivateKey);
  console.log(`🟡 Yellow: Session key = ${sessionAccount.address}`);

  // Connect to ClearNode
  await connectToClearNode();
}

// ── ClearNode WebSocket Connection ────────────

function connectToClearNode(): Promise<void> {
  return new Promise((resolve) => {
    const wsUrl = process.env.YELLOW_WS_URL ?? YELLOW_WS_URL;
    ws = new WebSocket(wsUrl);

    ws.onopen = async () => {
      console.log("🟡 Yellow: ClearNode WebSocket connected");
      try {
        await startAuth();
      } catch (err) {
        console.error("🟡 Yellow: Auth flow error (non-fatal)", err);
      }
      resolve();
    };

    ws.onclose = () => {
      console.log("🟡 Yellow: ClearNode WebSocket closed");
      authenticated = false;
      // Auto-reconnect after 5s
      setTimeout(() => {
        if (serverAccount) {
          console.log("🟡 Yellow: Reconnecting...");
          connectToClearNode().catch(console.error);
        }
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error("🟡 Yellow: WS error", err.message);
    };

    ws.onmessage = (event) => {
      handleClearNodeMessage(event.data.toString());
    };

    // Resolve even if auth fails (non-blocking)
    setTimeout(() => resolve(), 3000);
  });
}

// ── Authentication (EIP-712 Challenge-Response) ─

// Store auth params so we can reuse them for the EIP-712 signer
let authParams: AuthRequestParams | null = null;

async function startAuth(): Promise<void> {
  if (!ws || !serverAccount || !sessionAccount) return;

  // Field names MUST match the SDK's AuthRequestParams exactly:
  //   address, session_key, application, allowances, expires_at, scope
  authParams = {
    address: serverAccount.address,
    session_key: sessionAccount.address,
    application: BEATSTREAM_APP_NAME,
    allowances: [],
    expires_at: BigInt(Math.floor(Date.now() / 1000) + 86400),
    scope: "console",
  };

  const authReqMsg = await createAuthRequestMessage(authParams);

  ws.send(authReqMsg);
  console.log("🟡 Yellow: Auth request sent, waiting for challenge...");
}

async function handleAuthChallenge(rawChallengeMessage: string): Promise<void> {
  if (!ws || !walletClient || !serverAccount || !authParams) return;

  try {
    // Parse the raw auth_challenge response using the SDK helper
    const parsedChallenge = parseAuthChallengeResponse(rawChallengeMessage);
    console.log("🟡 Yellow: Parsed challenge →", parsedChallenge.params.challengeMessage);

    // EIP-712 signer must match the auth request params exactly
    const eip712Signer = createEIP712AuthMessageSigner(
      walletClient,
      {
        scope: authParams.scope,
        session_key: authParams.session_key,
        expires_at: authParams.expires_at,
        allowances: authParams.allowances,
      },
      { name: authParams.application }
    );

    // Use createAuthVerifyMessage (the official working approach)
    // NOTE: createAuthVerifyMessageFromChallenge has known issues in the SDK
    const verifyMsg = await createAuthVerifyMessage(
      eip712Signer,
      parsedChallenge
    );
    ws.send(verifyMsg);
    console.log("🟡 Yellow: Auth verify message sent");
  } catch (err) {
    console.error("🟡 Yellow: EIP-712 signing failed", err);
  }
}

// ── ClearNode Message Router ──────────────────

function handleClearNodeMessage(raw: string): void {
  try {
    // First, try to detect the method from the raw JSON to handle auth_challenge
    // with the SDK's parseAuthChallengeResponse (the official working path)
    let rawJson: { res?: unknown[] };
    try {
      rawJson = JSON.parse(raw);
    } catch {
      console.error("🟡 Yellow: Failed to parse raw JSON");
      return;
    }

    // Detect method from res[1] (standard RPC format: [id, method, params, ts])
    const resArray = rawJson.res;
    const method = resArray?.[1] as string | undefined;

    // Auth challenge: use the SDK's parseAuthChallengeResponse + createAuthVerifyMessage
    // This is the official working approach (createAuthVerifyMessageFromChallenge has known bugs)
    if (method === "auth_challenge") {
      console.log("🟡 Yellow: Auth challenge received");
      handleAuthChallenge(raw);
      return;
    }

    // For all other messages, use parseAnyRPCResponse (replaces NitroliteRPC.parseResponse in v0.5.x)
    let parsed;
    try {
      parsed = parseAnyRPCResponse(raw);
    } catch {
      console.warn("🟡 Yellow: Could not parse RPC response for method:", method);
      return;
    }

    // Handle errors
    if (parsed.method === RPCMethod.Error) {
      const errParams = parsed.params as { error?: string };
      console.error(`🟡 Yellow RPC Error:`, errParams?.error ?? parsed.params);
      if (parsed.requestId !== undefined) {
        const pending = pendingRequests.get(parsed.requestId);
        if (pending) {
          pending.reject(new Error(errParams?.error ?? "RPC Error"));
          pendingRequests.delete(parsed.requestId);
        }
      }
      return;
    }

    switch (parsed.method) {
      case RPCMethod.AuthVerify: {
        authenticated = true;
        const verifyParams = parsed.params as { success?: boolean; jwtToken?: string };
        if (verifyParams.jwtToken) {
          console.log("🟡 Yellow: ✅ Authenticated with ClearNode! JWT received.");
        } else {
          console.log("🟡 Yellow: ✅ Authenticated with ClearNode!");
        }
        break;
      }

      case RPCMethod.CreateAppSession: {
        const sessionParams = parsed.params as { appSessionId?: Hex };
        console.log(`🟡 Yellow: App session created → ${sessionParams.appSessionId}`);
        resolvePending(parsed.requestId, sessionParams);
        break;
      }

      case RPCMethod.SubmitAppState:
        resolvePending(parsed.requestId, { success: true });
        break;

      case RPCMethod.CloseAppSession:
        console.log("🟡 Yellow: App session closed");
        resolvePending(parsed.requestId, { success: true });
        break;

      case RPCMethod.Ping:
        if (sessionSigner && ws) {
          createPingMessage(sessionSigner).then((msg) => ws!.send(msg)).catch(() => {});
        }
        break;

      case RPCMethod.BalanceUpdate:
        console.log("🟡 Yellow: Balance update", parsed.params);
        break;

      default:
        resolvePending(parsed.requestId, parsed.params);
    }
  } catch {
    // Non-parseable message
  }
}

function resolvePending(requestId: number | undefined, data: unknown): void {
  if (requestId === undefined) return;
  const pending = pendingRequests.get(requestId);
  if (pending) {
    pending.resolve(data);
    pendingRequests.delete(requestId);
  }
}

// ── Helper: Send & Wait ───────────────────────

function sendAndWait(msg: string, requestId: number, timeoutMs = 15000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    ws!.send(msg);
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Yellow: Request timeout"));
      }
    }, timeoutMs);
  });
}

// ══════════════════════════════════════════════
// PUBLIC API — called by routes/stream.ws.ts
// ══════════════════════════════════════════════

/**
 * Open a Yellow App Session for a streaming session.
 * Creates a 2-party payment channel: user ↔ server (hub).
 */
export async function openStreamSession(
  beatstreamSessionId: string,
  userAddress: string,
  initialBeats: number
): Promise<{ appSessionId: string } | null> {
  if (!ws || !sessionSigner || !authenticated || !serverAccount) {
    console.warn("Yellow: Not connected/authenticated, using fallback");
    return null;
  }

  try {
    const requestId = Date.now();

    const appDef: RPCAppDefinition = {
      application: BEATSTREAM_APP_NAME,
      protocol: RPCProtocolVersion.NitroRPC_0_2,
      participants: [userAddress as Hex, serverAccount.address],
      weights: [100, 0],
      quorum: 100,
      challenge: 0,
      nonce: requestId,
    };

    const allocations = [
      {
        participant: userAddress as Address,
        asset: YELLOW_TEST_TOKEN_ASSET,
        amount: String(initialBeats),
      },
      {
        participant: serverAccount.address,
        asset: YELLOW_TEST_TOKEN_ASSET,
        amount: "0",
      },
    ];

    const msg = await createAppSessionMessage(
      sessionSigner,
      { definition: appDef, allocations },
      requestId
    );

    const result = (await sendAndWait(msg, requestId)) as { appSessionId: Hex };
    activeAppSessions.set(beatstreamSessionId, result.appSessionId);

    console.log(`🟡 Yellow: Stream ${beatstreamSessionId} → app ${result.appSessionId}`);
    return { appSessionId: result.appSessionId };
  } catch (err) {
    console.error("🟡 Yellow: openStreamSession error", err);
    return null;
  }
}

/**
 * Update state channel allocation (shift 1 beat from user → server per tick).
 * Called every second during streaming. Fire-and-forget for speed.
 */
export async function updateStreamState(
  beatstreamSessionId: string,
  userAddress: string,
  userBeats: number,
  serverBeats: number
): Promise<boolean> {
  if (!ws || !sessionSigner || !authenticated || !serverAccount) return false;

  const appSessionId = activeAppSessions.get(beatstreamSessionId);
  if (!appSessionId) return false;

  try {
    const requestId = Date.now();

    const allocations = [
      {
        participant: userAddress as Address,
        asset: YELLOW_TEST_TOKEN_ASSET,
        amount: String(userBeats),
      },
      {
        participant: serverAccount.address,
        asset: YELLOW_TEST_TOKEN_ASSET,
        amount: String(serverBeats),
      },
    ];

    const msg = await createSubmitAppStateMessage(
      sessionSigner,
      { app_session_id: appSessionId, allocations },
      requestId
    );

    ws.send(msg); // Fire-and-forget for per-second speed
    return true;
  } catch (err) {
    console.error("🟡 Yellow: updateStreamState error", err);
    return false;
  }
}

/**
 * Close the app session when streaming ends.
 * Final allocations determine payout split.
 */
export async function closeStreamSession(
  beatstreamSessionId: string,
  userAddress: string,
  userRemainingBeats: number,
  serverEarnedBeats: number
): Promise<boolean> {
  if (!ws || !sessionSigner || !authenticated || !serverAccount) return false;

  const appSessionId = activeAppSessions.get(beatstreamSessionId);
  if (!appSessionId) {
    console.warn(`Yellow: No app session for ${beatstreamSessionId}`);
    return false;
  }

  try {
    const requestId = Date.now();

    const finalAllocations = [
      {
        participant: userAddress as Address,
        asset: YELLOW_TEST_TOKEN_ASSET,
        amount: String(userRemainingBeats),
      },
      {
        participant: serverAccount.address,
        asset: YELLOW_TEST_TOKEN_ASSET,
        amount: String(serverEarnedBeats),
      },
    ];

    const msg = await createCloseAppSessionMessage(
      sessionSigner,
      { app_session_id: appSessionId, allocations: finalAllocations },
      requestId
    );

    await sendAndWait(msg, requestId);
    activeAppSessions.delete(beatstreamSessionId);

    console.log(
      `🟡 Yellow: Session ${beatstreamSessionId} closed (user: ${userRemainingBeats}, server: ${serverEarnedBeats})`
    );
    return true;
  } catch (err) {
    console.error("🟡 Yellow: closeStreamSession error", err);
    return false;
  }
}

/**
 * Cleanup: close all stale channels (useful for dev resets)
 */
export async function closeAllChannels(): Promise<void> {
  if (!ws || !sessionSigner || !authenticated || !serverAccount) return;

  try {
    const requestId = Date.now();
    const msg = await createGetChannelsMessage(
      sessionSigner,
      serverAccount.address,
      RPCChannelStatus.Open,
      requestId
    );

    const result = (await sendAndWait(msg, requestId)) as Record<string, unknown>[];
    if (!result || !Array.isArray(result)) return;

    for (const ch of result) {
      const chId = ch.channel_id as Hex;
      const closeMsg = await createCloseChannelMessage(
        sessionSigner,
        chId,
        serverAccount.address,
        Date.now()
      );
      ws.send(closeMsg);
      console.log(`🟡 Yellow: Closing channel ${chId}`);
    }
  } catch (err) {
    console.error("🟡 Yellow: closeAllChannels error", err);
  }
}

// ── Status ────────────────────────────────────

export function getYellowStatus(): {
  connected: boolean;
  authenticated: boolean;
  address: string | null;
  sessionKey: string | null;
  activeAppSessions: number;
} {
  return {
    connected: ws?.readyState === WebSocket.OPEN,
    authenticated,
    address: serverAccount?.address ?? null,
    sessionKey: sessionAccount?.address ?? null,
    activeAppSessions: activeAppSessions.size,
  };
}
