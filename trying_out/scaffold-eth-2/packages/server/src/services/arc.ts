// ──────────────────────────────────────────────
// Circle Contracts (Arc) Service
// Uses @circle-fin/smart-contract-platform SDK
// and @circle-fin/developer-controlled-wallets
//
// Handles:
//   1. Deploying BeatStreamVault + MockUSDC to Arc Testnet
//   2. Executing vault.settle() to pay artists
//   3. Querying vault.getDeposit() and vault.vaultBalance()
//   4. Monitoring Deposited events via Circle Event Monitoring
// ──────────────────────────────────────────────
import {
  initiateSmartContractPlatformClient,
  type SmartContractPlatformClient,
} from "@circle-fin/smart-contract-platform";
import {
  initiateDeveloperControlledWalletsClient,
  type DeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import {
  ARC_TESTNET_CHAIN,
  ARC_USDC_ADDRESS,
  BEATS_PER_USDC,
  USDC_DECIMALS,
} from "../config/constants.js";

// ── Module state ──────────────────────────────

let contractSdk: SmartContractPlatformClient | null = null;
let walletSdk: DeveloperControlledWalletsClient | null = null;

let circleWalletId: string | null = null;
let circleWalletAddress: string | null = null;
let vaultContractId: string | null = null;
let vaultContractAddress: string | null = null;
let usdcContractAddress: string = ARC_USDC_ADDRESS;

// ── Initialization ────────────────────────────

export function initArc(): void {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret || apiKey === "your_circle_api_key") {
    console.warn(
      "⚠️  Arc: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET not set. Settlement disabled."
    );
    return;
  }

  // Initialize Circle SDKs
  contractSdk = initiateSmartContractPlatformClient({
    apiKey,
    entitySecret,
  });

  walletSdk = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  circleWalletId = process.env.CIRCLE_WALLET_ID ?? null;
  circleWalletAddress = process.env.CIRCLE_WALLET_ADDRESS ?? null;
  vaultContractId = process.env.CIRCLE_VAULT_CONTRACT_ID ?? null;

  console.log("✅ Circle Arc initialized");
  console.log(`   Wallet ID: ${circleWalletId ?? "(not set)"}`);
  console.log(`   Vault Contract ID: ${vaultContractId ?? "(not set)"}`);
}

// ══════════════════════════════════════════════
// WALLET MANAGEMENT
// ══════════════════════════════════════════════

/**
 * Create a developer-controlled wallet on Arc Testnet.
 * Only needed once during initial setup.
 */
export async function createArcWallet(): Promise<{
  walletId: string;
  address: string;
} | null> {
  if (!walletSdk) {
    console.warn("Arc: SDK not initialized");
    return null;
  }

  try {
    // Create wallet set
    const walletSetRes = await walletSdk.createWalletSet({
      name: "BeatStream WalletSet",
    });
    const walletSetId = walletSetRes.data?.walletSet?.id;
    if (!walletSetId) throw new Error("Failed to create wallet set");

    // Create wallet on Arc Testnet
    const walletsRes = await walletSdk.createWallets({
      blockchains: [ARC_TESTNET_CHAIN],
      count: 1,
      walletSetId,
    });

    const wallet = walletsRes.data?.wallets?.[0];
    if (!wallet) throw new Error("Failed to create wallet");

    circleWalletId = wallet.id;
    circleWalletAddress = wallet.address;

    console.log(`💰 Arc: Wallet created → ${wallet.address} (ID: ${wallet.id})`);
    return { walletId: wallet.id, address: wallet.address! };
  } catch (err) {
    console.error("Arc: createArcWallet error", err);
    return null;
  }
}

/**
 * Get the wallet's USDC balance on Arc Testnet.
 */
export async function getWalletBalance(): Promise<{
  native: string;
  usdc: string;
} | null> {
  if (!walletSdk || !circleWalletId) return null;

  try {
    const res = await walletSdk.getWalletTokenBalance({
      id: circleWalletId,
    });

    const balances = res.data?.tokenBalances ?? [];
    const nativeBal =
      balances.find((b: any) => b.token?.isNative)?.amount ?? "0";
    const usdcBal =
      balances.find(
        (b: any) =>
          b.token?.symbol === "USDC" || b.token?.contractAddress === ARC_USDC_ADDRESS
      )?.amount ?? "0";

    return { native: nativeBal, usdc: usdcBal };
  } catch (err) {
    console.error("Arc: getWalletBalance error", err);
    return null;
  }
}

// ══════════════════════════════════════════════
// CONTRACT DEPLOYMENT
// ══════════════════════════════════════════════

/**
 * Deploy the BeatStreamVault contract on Arc Testnet via Circle.
 * Requires compiled ABI + bytecode from hardhat artifacts.
 */
export async function deployVaultContract(
  abiJson: string,
  bytecode: string
): Promise<{ contractId: string; transactionId: string } | null> {
  if (!contractSdk || !circleWalletId || !circleWalletAddress) {
    console.warn("Arc: SDK or wallet not ready");
    return null;
  }

  try {
    const response = await contractSdk.deployContract({
      name: "BeatStreamVault",
      description:
        "USDC vault for pay-per-second music streaming. Manages deposits, beats, and artist settlements.",
      blockchain: ARC_TESTNET_CHAIN,
      walletId: circleWalletId,
      abiJson,
      bytecode,
      constructorParameters: [
        circleWalletAddress, // owner = our wallet
        ARC_USDC_ADDRESS, // USDC address on Arc Testnet
      ],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
    });

    const contractId = response.data?.contractId;
    const transactionId = response.data?.transactionId;

    if (contractId) {
      vaultContractId = contractId;
    }

    console.log(
      `🚀 Arc: Vault deployment submitted (contract: ${contractId}, tx: ${transactionId})`
    );
    return {
      contractId: contractId ?? "",
      transactionId: transactionId ?? "",
    };
  } catch (err) {
    console.error("Arc: deployVaultContract error", err);
    return null;
  }
}

/**
 * Check deployment status and get the on-chain contract address.
 */
export async function getContractInfo(contractId?: string): Promise<{
  status: string;
  contractAddress: string | null;
} | null> {
  if (!contractSdk) return null;
  const id = contractId ?? vaultContractId;
  if (!id) return null;

  try {
    const res = await contractSdk.getContract({ id });
    const contract = res.data?.contract;

    if (contract?.contractAddress) {
      vaultContractAddress = contract.contractAddress;
    }

    return {
      status: contract?.status ?? "UNKNOWN",
      contractAddress: contract?.contractAddress ?? null,
    };
  } catch (err) {
    console.error("Arc: getContractInfo error", err);
    return null;
  }
}

// ══════════════════════════════════════════════
// CONTRACT INTERACTIONS (Read & Write)
// ══════════════════════════════════════════════

/**
 * Read: Query the vault's total USDC balance.
 * Calls: BeatStreamVault.vaultBalance() -> uint256
 */
export async function queryVaultBalance(): Promise<string | null> {
  if (!contractSdk || !vaultContractAddress) return null;

  try {
    const res = await contractSdk.queryContract({
      address: vaultContractAddress,
      blockchain: ARC_TESTNET_CHAIN,
      abiFunctionSignature: "vaultBalance()",
      abiJson: JSON.stringify([
        {
          inputs: [],
          name: "vaultBalance",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ]),
    });

    const outputValues = (res.data as any)?.outputValues;
    return outputValues?.[0] ?? null;
  } catch (err) {
    console.error("Arc: queryVaultBalance error", err);
    return null;
  }
}

/**
 * Read: Query a user's deposit balance in the vault.
 * Calls: BeatStreamVault.getDeposit(address) -> uint256
 */
export async function queryUserDeposit(
  userAddress: string
): Promise<string | null> {
  if (!contractSdk || !vaultContractAddress) return null;

  try {
    const res = await contractSdk.queryContract({
      address: vaultContractAddress,
      blockchain: ARC_TESTNET_CHAIN,
      abiFunctionSignature: "getDeposit(address)",
      abiParameters: [userAddress],
      abiJson: JSON.stringify([
        {
          inputs: [{ name: "user", type: "address" }],
          name: "getDeposit",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ]),
    });

    const outputValues = (res.data as any)?.outputValues;
    return outputValues?.[0] ?? null;
  } catch (err) {
    console.error("Arc: queryUserDeposit error", err);
    return null;
  }
}

/**
 * Read: Query an artist's total earnings.
 * Calls: BeatStreamVault.getArtistEarnings(address) -> uint256
 */
export async function queryArtistEarnings(
  artistAddress: string
): Promise<string | null> {
  if (!contractSdk || !vaultContractAddress) return null;

  try {
    const res = await contractSdk.queryContract({
      address: vaultContractAddress,
      blockchain: ARC_TESTNET_CHAIN,
      abiFunctionSignature: "getArtistEarnings(address)",
      abiParameters: [artistAddress],
      abiJson: JSON.stringify([
        {
          inputs: [{ name: "artist", type: "address" }],
          name: "getArtistEarnings",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ]),
    });

    const outputValues = (res.data as any)?.outputValues;
    return outputValues?.[0] ?? null;
  } catch (err) {
    console.error("Arc: queryArtistEarnings error", err);
    return null;
  }
}

/**
 * Write: Settle a streaming session — pay artist from user's deposit.
 * Calls: BeatStreamVault.settle(address artist, uint256 beatsUsed, address user)
 *
 * This is the key Circle integration: the server (vault owner) calls settle()
 * to transfer USDC from user's deposit to the artist.
 */
export async function settlePayment(params: {
  totalBeats: number;
  artistWallet: string;
  userWallet: string;
  sessionId: string;
}): Promise<{ success: boolean; txHash?: string; usdcAmount?: number }> {
  const { totalBeats, artistWallet, userWallet, sessionId } = params;
  const usdcAmount = totalBeats / BEATS_PER_USDC;

  // Fallback: if Circle not configured, simulate
  if (!walletSdk || !circleWalletId || !vaultContractAddress) {
    console.warn("Arc: Not fully configured, simulating settlement");
    return {
      success: true,
      txHash: `0xsim_${sessionId}`,
      usdcAmount,
    };
  }

  try {
    // Execute settle(artist, beatsUsed, user) on the vault
    const response =
      await walletSdk.createContractExecutionTransaction({
        walletId: circleWalletId,
        contractAddress: vaultContractAddress,
        abiFunctionSignature:
          "settle(address,uint256,address)",
        abiParameters: [artistWallet, String(totalBeats), userWallet],
        fee: {
          type: "level",
          config: { feeLevel: "MEDIUM" },
        },
      });

    const txId = (response.data as any)?.transactionId;
    console.log(
      `💰 Arc: Settlement submitted for session ${sessionId} → ${usdcAmount} USDC to ${artistWallet} (tx: ${txId})`
    );

    return {
      success: true,
      txHash: txId ?? `pending_${sessionId}`,
      usdcAmount,
    };
  } catch (err) {
    console.error("Arc: settlePayment error", err);
    return { success: false };
  }
}

/**
 * Verify a deposit transaction on Arc Testnet.
 * Queries Circle's transaction API for confirmation status.
 */
export async function verifyDeposit(txHash: string): Promise<{
  verified: boolean;
  amount?: number;
  fromWallet?: string;
}> {
  if (!walletSdk) {
    console.warn("Arc: SDK not initialized, simulating deposit verification");
    return { verified: true, amount: 10, fromWallet: "0xsimulated" };
  }

  try {
    const response = await walletSdk.getTransaction({ id: txHash });
    const tx = response.data?.transaction;

    if (tx?.state === "COMPLETE") {
      return {
        verified: true,
        amount: parseFloat((tx as any).amounts?.[0] ?? "0"),
        fromWallet: (tx as any).sourceAddress,
      };
    }

    return { verified: false };
  } catch (err) {
    console.error("Arc: verifyDeposit error", err);
    return { verified: false };
  }
}

// ══════════════════════════════════════════════
// STATUS & HELPERS
// ══════════════════════════════════════════════

export function getArcStatus(): {
  initialized: boolean;
  walletId: string | null;
  walletAddress: string | null;
  vaultContractId: string | null;
  vaultContractAddress: string | null;
  usdcAddress: string;
  blockchain: string;
} {
  return {
    initialized: !!contractSdk,
    walletId: circleWalletId,
    walletAddress: circleWalletAddress,
    vaultContractId,
    vaultContractAddress,
    usdcAddress: usdcContractAddress,
    blockchain: ARC_TESTNET_CHAIN,
  };
}
