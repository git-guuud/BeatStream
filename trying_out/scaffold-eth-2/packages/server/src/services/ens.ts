// ──────────────────────────────────────────────
// ENS Service — On-Chain Integration
// Handles artist subdomain registration and
// fan subdomain minting on beatstream.eth
// Uses viem to interact with ENS NameWrapper
// on Sepolia testnet
// ──────────────────────────────────────────────
import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  labelhash,
  encodeFunctionData,
  type Hex,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { FAN_SUBDOMAIN_THRESHOLD, BEATSTREAM_ENS_DOMAIN } from "../config/constants.js";

// ── ENS Contract Addresses (Sepolia) ──────────

const ENS_CONTRACTS = {
  // ENS NameWrapper on Sepolia
  nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8" as Address,
  // ENS Public Resolver on Sepolia
  publicResolver: "0x8FADE66B79cC9f1C6F971901BaD5484eD3276E7e" as Address,
  // ENS Registry on Sepolia
  registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as Address,
};

// ── Minimal ABIs ──────────────────────────────

const NAME_WRAPPER_ABI = [
  {
    name: "setSubnodeRecord",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "isWrapped",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const RESOLVER_ABI = [
  {
    name: "setAddr",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "addr", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ── Module state ──────────────────────────────

let ensEnabled = false;
let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;
let serverAccount: ReturnType<typeof privateKeyToAccount> | null = null;

// ── Initialization ────────────────────────────

export function initENS(): void {
  const rpcUrl = process.env.ALCHEMY_RPC_URL;
  const pk = process.env.YELLOW_PRIVATE_KEY as Hex | undefined;

  if (!rpcUrl) {
    console.warn("⚠️  ENS: No ALCHEMY_RPC_URL — on-chain features disabled");
    ensEnabled = true; // offline mode — name generation still works
    console.log("✅ ENS service initialized (offline mode)");
    return;
  }

  publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  if (pk) {
    serverAccount = privateKeyToAccount(pk);
    walletClient = createWalletClient({
      account: serverAccount,
      chain: sepolia,
      transport: http(rpcUrl),
    });
    console.log(`   ENS server signer: ${serverAccount.address}`);
  } else {
    console.warn("⚠️  ENS: No private key — read-only mode");
  }

  ensEnabled = true;
  console.log("✅ ENS service initialized (on-chain mode — Sepolia)");
}

// ══════════════════════════════════════════════
// NAME GENERATION (works offline)
// ══════════════════════════════════════════════

/**
 * Generate the ENS subdomain for an artist.
 * Format: <artistName>.beatstream.eth
 */
export function generateArtistENS(artistName: string): string {
  const sanitized = artistName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) {
    throw new Error("Invalid artist name for ENS");
  }

  return `${sanitized}.${BEATSTREAM_ENS_DOMAIN}`;
}

/**
 * Validate that an ENS name follows beatstream.eth format
 */
export function isValidBeatStreamENS(name: string): boolean {
  return new RegExp(`^[a-z0-9-]+\\.${BEATSTREAM_ENS_DOMAIN.replace(".", "\\.")}$`).test(name);
}

/**
 * Generate the fan subdomain name.
 * Format: fan-<first6charsOfWallet>.<artistName>.beatstream.eth
 */
export function generateFanSubdomain(
  fanWallet: string,
  artistEnsName: string
): string {
  const walletPrefix = fanWallet.toLowerCase().replace("0x", "").slice(0, 6);
  const artistLabel = artistEnsName.replace(`.${BEATSTREAM_ENS_DOMAIN}`, "");
  return `fan-${walletPrefix}.${artistLabel}.${BEATSTREAM_ENS_DOMAIN}`;
}

// ══════════════════════════════════════════════
// ELIGIBILITY CHECKS
// ══════════════════════════════════════════════

/**
 * Check if a fan qualifies for a subdomain based on total beats streamed.
 * After streaming 100+ beats from an artist, the fan can mint their subdomain.
 */
export function checkFanSubdomainEligibility(totalBeatsStreamed: number): boolean {
  return totalBeatsStreamed >= FAN_SUBDOMAIN_THRESHOLD;
}

// ══════════════════════════════════════════════
// ON-CHAIN READ OPERATIONS
// ══════════════════════════════════════════════

/**
 * Check if a subdomain is already registered on-chain via NameWrapper.
 */
export async function isSubdomainRegistered(fullName: string): Promise<boolean> {
  if (!publicClient) return false;

  try {
    const node = namehash(normalize(fullName));
    const owner = await publicClient.readContract({
      address: ENS_CONTRACTS.nameWrapper,
      abi: NAME_WRAPPER_ABI,
      functionName: "ownerOf",
      args: [BigInt(node)],
    });
    return owner !== "0x0000000000000000000000000000000000000000";
  } catch {
    // Token doesn't exist or other error — not registered
    return false;
  }
}

/**
 * Resolve an ENS name to an address via the public resolver.
 */
export async function resolveENS(fullName: string): Promise<Address | null> {
  if (!publicClient) return null;

  try {
    const node = namehash(normalize(fullName));
    const addr = await publicClient.readContract({
      address: ENS_CONTRACTS.publicResolver,
      abi: RESOLVER_ABI,
      functionName: "addr",
      args: [node],
    });
    if (addr === "0x0000000000000000000000000000000000000000") return null;
    return addr;
  } catch {
    return null;
  }
}

/**
 * Read a text record from an ENS name (e.g., "avatar", "url", "description")
 */
export async function getENSText(fullName: string, key: string): Promise<string | null> {
  if (!publicClient) return null;

  try {
    const node = namehash(normalize(fullName));
    const value = await publicClient.readContract({
      address: ENS_CONTRACTS.publicResolver,
      abi: RESOLVER_ABI,
      functionName: "text",
      args: [node, key],
    });
    return value || null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════
// ON-CHAIN WRITE OPERATIONS
// ══════════════════════════════════════════════

/**
 * Register an artist subdomain on-chain via NameWrapper.setSubnodeRecord().
 *
 * This creates <artistName>.beatstream.eth pointing to the artist's wallet.
 *
 * Requirements:
 * - Server wallet must be the owner or approved operator of beatstream.eth
 *   in the NameWrapper contract.
 * - For hackathon demo: if we don't own beatstream.eth, we simulate and
 *   return a mock tx hash so the flow works end-to-end.
 */
export async function registerArtistSubdomain(
  artistName: string,
  artistWallet: Address
): Promise<{ txHash: Hex | null; subdomain: string; simulated: boolean }> {
  const subdomain = generateArtistENS(artistName);
  const label = artistName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!walletClient || !serverAccount || !publicClient) {
    console.log(`📋 ENS (simulated): Would register ${subdomain} → ${artistWallet}`);
    return { txHash: null, subdomain, simulated: true };
  }

  try {
    const parentNode = namehash(normalize(BEATSTREAM_ENS_DOMAIN));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60); // 1 year

    const txHash = await walletClient.writeContract({
      chain: sepolia,
      account: serverAccount!,
      address: ENS_CONTRACTS.nameWrapper,
      abi: NAME_WRAPPER_ABI,
      functionName: "setSubnodeRecord",
      args: [
        parentNode,
        label,
        artistWallet,
        ENS_CONTRACTS.publicResolver,
        BigInt(0),  // TTL
        0,          // fuses (no restrictions for hackathon)
        expiry,
      ],
    });

    console.log(`🔗 ENS: Registered ${subdomain} → ${artistWallet} (tx: ${txHash})`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`✅ ENS: Confirmed in block ${receipt.blockNumber}`);

    return { txHash, subdomain, simulated: false };
  } catch (err: any) {
    // If we don't own the parent name, fall back to simulation
    if (
      err.message?.includes("Unauthorised") ||
      err.message?.includes("revert") ||
      err.message?.includes("execution reverted")
    ) {
      console.warn(`⚠️  ENS: Cannot register on-chain (not parent owner), simulating`);
      return { txHash: null, subdomain, simulated: true };
    }
    throw err;
  }
}

/**
 * Mint a fan subdomain on-chain via NameWrapper.
 *
 * Creates fan-<walletPrefix>.<artist>.beatstream.eth
 * pointing to the fan's wallet.
 *
 * This is a two-level subdomain: the server must own <artist>.beatstream.eth
 * to create subdomains under it.
 */
export async function mintFanSubdomain(
  fanWallet: Address,
  artistEnsName: string
): Promise<{ txHash: Hex | null; subdomain: string; simulated: boolean }> {
  const subdomain = generateFanSubdomain(fanWallet, artistEnsName);
  const walletPrefix = fanWallet.toLowerCase().replace("0x", "").slice(0, 6);
  const fanLabel = `fan-${walletPrefix}`;

  if (!walletClient || !serverAccount || !publicClient) {
    console.log(`📋 ENS (simulated): Would mint ${subdomain} → ${fanWallet}`);
    return { txHash: null, subdomain, simulated: true };
  }

  try {
    // Parent is <artist>.beatstream.eth
    const parentNode = namehash(normalize(artistEnsName));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

    const txHash = await walletClient.writeContract({
      chain: sepolia,
      account: serverAccount!,
      address: ENS_CONTRACTS.nameWrapper,
      abi: NAME_WRAPPER_ABI,
      functionName: "setSubnodeRecord",
      args: [
        parentNode,
        fanLabel,
        fanWallet,
        ENS_CONTRACTS.publicResolver,
        BigInt(0),
        0,
        expiry,
      ],
    });

    console.log(`🔗 ENS: Minted fan ${subdomain} → ${fanWallet} (tx: ${txHash})`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`✅ ENS: Fan subdomain confirmed in block ${receipt.blockNumber}`);

    return { txHash, subdomain, simulated: false };
  } catch (err: any) {
    if (
      err.message?.includes("Unauthorised") ||
      err.message?.includes("revert") ||
      err.message?.includes("execution reverted")
    ) {
      console.warn(`⚠️  ENS: Cannot mint fan subdomain on-chain, simulating`);
      return { txHash: null, subdomain, simulated: true };
    }
    throw err;
  }
}

/**
 * Set text records on an ENS name (avatar, url, description, etc.)
 */
export async function setENSTextRecord(
  fullName: string,
  key: string,
  value: string
): Promise<Hex | null> {
  if (!walletClient || !publicClient) return null;

  try {
    const node = namehash(normalize(fullName));
    const txHash = await walletClient.writeContract({
      chain: sepolia,
      account: serverAccount!,
      address: ENS_CONTRACTS.publicResolver,
      abi: RESOLVER_ABI,
      functionName: "setText",
      args: [node, key, value],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    console.warn(`⚠️  ENS: Failed to set text record ${key} on ${fullName}:`, err);
    return null;
  }
}

// ══════════════════════════════════════════════
// API METADATA HELPERS
// ══════════════════════════════════════════════

/**
 * Build ENS metadata object for an artist profile.
 */
export function buildArtistENSMetadata(artist: {
  ens_name: string;
  display_name: string;
  avatar_url?: string;
  wallet_address: string;
}) {
  return {
    name: artist.ens_name,
    displayName: artist.display_name,
    avatar: artist.avatar_url ?? null,
    address: artist.wallet_address,
    resolveOnChain: true,
    chain: "sepolia",
    nameWrapperAddress: ENS_CONTRACTS.nameWrapper,
  };
}

// ── Status ────────────────────────────────────

export function getENSStatus(): {
  enabled: boolean;
  onChain: boolean;
  threshold: number;
  parentDomain: string;
  contracts: typeof ENS_CONTRACTS;
} {
  return {
    enabled: ensEnabled,
    onChain: walletClient !== null,
    threshold: FAN_SUBDOMAIN_THRESHOLD,
    parentDomain: BEATSTREAM_ENS_DOMAIN,
    contracts: ENS_CONTRACTS,
  };
}
