// ──────────────────────────────────────────────
// Signature Verification using viem
// ──────────────────────────────────────────────
import { verifyMessage, type Hex } from "viem";

/**
 * Verify that a message was signed by the expected wallet address.
 * Used for authenticating API requests and stream vouchers.
 */
export async function verifySig(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    const recovered = await verifyMessage({
      message,
      signature: signature as Hex,
      address: expectedAddress as `0x${string}`,
    });
    return recovered;
  } catch {
    return false;
  }
}

/**
 * Create the canonical message to be signed for a stream voucher.
 * Both client and server use this to produce the same message.
 */
export function buildStreamVoucherMessage(params: {
  sessionId: string;
  trackId: string;
  secondsPlayed: number;
  totalBeatsPaid: number;
}): string {
  return [
    "BeatStream Voucher",
    `Session: ${params.sessionId}`,
    `Track: ${params.trackId}`,
    `Seconds: ${params.secondsPlayed}`,
    `TotalBeats: ${params.totalBeatsPaid}`,
  ].join("\n");
}

/**
 * Build the auth message used for wallet login.
 */
export function buildAuthMessage(wallet: string, nonce: number): string {
  return `Sign in to BeatStream\nWallet: ${wallet}\nNonce: ${nonce}`;
}
