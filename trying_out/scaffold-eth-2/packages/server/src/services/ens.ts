// ──────────────────────────────────────────────
// ENS Service
// Handles artist subdomain registration and
// fan subdomain minting on beatstream.eth
// ──────────────────────────────────────────────
import { FAN_SUBDOMAIN_THRESHOLD } from "../config/constants.js";

// ── Module state ──────────────────────────────

let ensEnabled = false;

// ── Initialization ────────────────────────────

export function initENS(): void {
  // ENS resolution primarily happens on the frontend via wagmi hooks.
  // The server's role is to:
  // 1. Track which artists have registered subdomains
  // 2. Determine when fans qualify for subdomain minting
  // 3. Provide ENS metadata for the API
  ensEnabled = true;
  console.log("✅ ENS service initialized");
}

// ── Artist subdomain ──────────────────────────

/**
 * Generate the ENS subdomain for an artist.
 * Format: <artistName>.beatstream.eth
 *
 * Actual on-chain registration is done via the frontend
 * using the ENS NameWrapper contract on mainnet/sepolia.
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

  return `${sanitized}.beatstream.eth`;
}

/**
 * Validate that an ENS name follows beatstream.eth format
 */
export function isValidBeatStreamENS(name: string): boolean {
  return /^[a-z0-9-]+\.beatstream\.eth$/.test(name);
}

// ── Fan subdomain ─────────────────────────────

/**
 * Check if a fan qualifies for a subdomain based on total seconds streamed.
 * After streaming 100+ seconds from an artist, the fan can mint:
 * fan-<walletPrefix>.artist.beatstream.eth
 */
export function checkFanSubdomainEligibility(totalSecondsStreamed: number): boolean {
  return totalSecondsStreamed >= FAN_SUBDOMAIN_THRESHOLD;
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
  // artistEnsName is like "synthwave.beatstream.eth"
  // We want "fan-abc123.synthwave.beatstream.eth"
  const artistLabel = artistEnsName.replace(".beatstream.eth", "");

  return `fan-${walletPrefix}.${artistLabel}.beatstream.eth`;
}

// ── Resolution helpers (for API responses) ────

/**
 * Build ENS metadata object for an artist profile.
 * The frontend uses this to display ENS info and avatars.
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
    // The frontend will use wagmi's useEnsName/useEnsAvatar with chainId: 1
    // to resolve and display the name
    resolveOnChain: true,
  };
}

// ── Status ────────────────────────────────────

export function getENSStatus(): { enabled: boolean; threshold: number } {
  return {
    enabled: ensEnabled,
    threshold: FAN_SUBDOMAIN_THRESHOLD,
  };
}
