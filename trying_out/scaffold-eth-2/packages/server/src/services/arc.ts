// ──────────────────────────────────────────────
// Circle Arc Service
// Handles USDC settlement and contract interaction
// via Circle's Developer-Controlled Wallets
// ──────────────────────────────────────────────
import { ARC_USDC_ADDRESS, BEATS_PER_USDC } from "../config/constants.js";

// ── Module state ──────────────────────────────

let circleApiKey: string | null = null;
let circleEntitySecret: string | null = null;

// ── Initialization ────────────────────────────

export function initArc(): void {
  circleApiKey = process.env.CIRCLE_API_KEY ?? null;
  circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET ?? null;

  if (!circleApiKey || !circleEntitySecret) {
    console.warn("⚠️  Arc: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET not set. Settlement disabled.");
    return;
  }

  console.log("✅ Circle Arc initialized");
}

// ── Settlement ────────────────────────────────

/**
 * Settle a streaming session by transferring USDC from vault to artist.
 * Called when a session is closed and the accumulated beats need to be
 * converted to USDC and sent to the artist's wallet.
 *
 * In a full implementation this would:
 * 1. Call the BeatStreamVault.settle() via Circle's Smart Contract Platform
 * 2. The vault converts beats → USDC and transfers to artist
 *
 * For hackathon: we use Circle's API to execute the contract call.
 */
export async function settlePayment(params: {
  totalBeats: number;
  artistWallet: string;
  sessionId: string;
}): Promise<{ success: boolean; txHash?: string; usdcAmount?: number }> {
  const { totalBeats, artistWallet, sessionId } = params;
  const usdcAmount = totalBeats / BEATS_PER_USDC;

  if (!circleApiKey) {
    console.warn("Arc: API key not set, simulating settlement");
    return {
      success: true,
      txHash: `0xsim_${sessionId}`,
      usdcAmount,
    };
  }

  try {
    // Call Circle's Smart Contract Platform API to execute settle()
    // on the BeatStreamVault contract
    const response = await fetch(
      "https://api.circle.com/v1/w3s/developer/transactions/contractExecution",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          // Circle Arc contract execution payload
          // This calls BeatStreamVault.settle(artistWallet, totalBeats)
          walletId: process.env.CIRCLE_WALLET_ID,
          callData: encodeSettleCallData(artistWallet, totalBeats),
          contractAddress: process.env.VAULT_CONTRACT_ADDRESS,
          fee: { type: "level", config: { feeLevel: "MEDIUM" } },
          entitySecretCiphertext: circleEntitySecret,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Arc: Settlement API error", errBody);
      return { success: false };
    }

    const result = (await response.json()) as {
      data?: { id?: string; txHash?: string };
    };
    console.log(`💰 Arc: Settlement submitted for session ${sessionId}, USDC: ${usdcAmount}`);

    return {
      success: true,
      txHash: result.data?.txHash ?? result.data?.id,
      usdcAmount,
    };
  } catch (err) {
    console.error("Arc: Settlement error", err);
    return { success: false };
  }
}

// ── Deposit monitoring ────────────────────────

/**
 * Verify a USDC deposit transaction on Arc Testnet.
 * In production this would poll Circle's transaction API
 * or listen to webhook events.
 */
export async function verifyDeposit(txHash: string): Promise<{
  verified: boolean;
  amount?: number;
  fromWallet?: string;
}> {
  if (!circleApiKey) {
    console.warn("Arc: API key not set, simulating deposit verification");
    return { verified: true, amount: 10, fromWallet: "0xsimulated" };
  }

  try {
    const response = await fetch(
      `https://api.circle.com/v1/w3s/transactions/${txHash}`,
      {
        headers: {
          Authorization: `Bearer ${circleApiKey}`,
        },
      }
    );

    if (!response.ok) {
      return { verified: false };
    }

    const result = (await response.json()) as {
      data?: { transaction?: { amounts?: string[]; sourceAddress?: string; state?: string } };
    };
    const tx = result.data?.transaction;

    if (tx?.state === "COMPLETE") {
      return {
        verified: true,
        amount: parseFloat(tx.amounts?.[0] ?? "0"),
        fromWallet: tx.sourceAddress,
      };
    }

    return { verified: false };
  } catch (err) {
    console.error("Arc: Deposit verification error", err);
    return { verified: false };
  }
}

// ── Helpers ───────────────────────────────────

/**
 * ABI-encode the settle() function call.
 * settle(address artist, uint256 totalBeats)
 */
function encodeSettleCallData(artistWallet: string, totalBeats: number): string {
  // Function selector for settle(address,uint256)
  const selector = "0x" + "a9059cbb"; // Placeholder — will be replaced with actual selector

  // For hackathon, we'll use viem's encodeFunctionData on the frontend
  // and pass the encoded calldata. This is a simplified version.
  const paddedAddress = artistWallet.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedAmount = totalBeats.toString(16).padStart(64, "0");

  return selector + paddedAddress + paddedAmount;
}

export function getArcStatus(): { initialized: boolean; usdcAddress: string } {
  return {
    initialized: !!circleApiKey,
    usdcAddress: ARC_USDC_ADDRESS,
  };
}
