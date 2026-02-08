// ──────────────────────────────────────────────
// BeatStream Shared Constants
// ──────────────────────────────────────────────

/** 1000 Beats = 1 USDC */
export const BEATS_PER_USDC = 1000;

/** USDC uses 6 decimal places */
export const USDC_DECIMALS = 6;

/** Each audio chunk is 5 seconds */
export const CHUNK_DURATION_SECONDS = 5;

/** 1 Beat consumed per second of streaming */
export const BEATS_PER_SECOND = 1;

/** Beats consumed per chunk (5 seconds = 5 beats) */
export const BEATS_PER_CHUNK = CHUNK_DURATION_SECONDS * BEATS_PER_SECOND;

/** Min total beats streamed to earn a fan subdomain */
export const FAN_SUBDOMAIN_THRESHOLD = 100;

/** Parent ENS domain */
export const BEATSTREAM_ENS_DOMAIN = "beatstream.eth";

/** App name used in Yellow auth and ENS metadata */
export const BEATSTREAM_APP_NAME = "BeatStream";

// ─── Yellow Network (Sandbox) ────────────────
export const YELLOW_CONTRACTS = {
  custody: "0x019B65A265EB3363822f2752141b3dF16131b262" as const,
  adjudicator: "0x7c7ccbc98469190849BCC6c926307794fDfB11F2" as const,
};

export const YELLOW_CHAIN_ID = 11155111; // Sepolia
export const YELLOW_WS_URL = "wss://clearnet-sandbox.yellow.com/ws";

/** ClearNode asset identifier for test USD */
export const YELLOW_TEST_TOKEN_ASSET = "ytest.usd";

/** On-chain ERC-20 address for ytest.usd on Sepolia */
export const YELLOW_TEST_TOKEN_ADDRESS =
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// ─── Circle Arc ──────────────────────────────
export const ARC_TESTNET_CHAIN = "ARC-TESTNET";
export const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";
