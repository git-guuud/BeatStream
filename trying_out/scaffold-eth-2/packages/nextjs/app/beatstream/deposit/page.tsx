"use client";

import { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { BeatStreamNav } from "../_components/BeatStreamNav";
import { useBeats } from "../_components/BeatsContext";

export default function DepositPage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  
  const { addBeats } = useBeats();

  // Get vault contract address for approval
  const { data: vaultInfo } = useDeployedContractInfo({ contractName: "BeatStreamVault" });
  const vaultAddress = vaultInfo?.address;

  // Read USDC balance
  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
  });

  // Read current allowance
  const { data: allowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [address, vaultAddress],
  });

  // Read beats per USDC conversion rate
  const { data: beatsPerUsdc } = useScaffoldReadContract({
    contractName: "BeatStreamVault",
    functionName: "BEATS_PER_USDC",
  });

  // Read user's current deposit (beats balance in vault)
  const { data: currentDeposit } = useScaffoldReadContract({
    contractName: "BeatStreamVault",
    functionName: "deposits",
    args: [address],
  });

  // Write hooks
  const { writeContractAsync: approveUsdc } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const { writeContractAsync: depositToVault } = useScaffoldWriteContract({
    contractName: "BeatStreamVault",
  });

  // Mint test USDC (for demo)
  const { writeContractAsync: mintUsdc } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const parsedAmount = amount ? parseUnits(amount, 6) : BigInt(0);
  const needsApproval = allowance !== undefined && parsedAmount > allowance;
  const hasEnoughBalance = usdcBalance !== undefined && parsedAmount <= usdcBalance;

  const handleApprove = async () => {
    if (!vaultAddress) return;
    setIsApproving(true);
    try {
      await approveUsdc({
        functionName: "approve",
        args: [vaultAddress, parsedAmount],
      });
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    setIsDepositing(true);
    try {
      await depositToVault({
        functionName: "deposit",
        args: [parsedAmount],
      });
      // Add beats to the shared context
      if (beatsPerUsdc) {
        const beatsToAdd = Number((parsedAmount * beatsPerUsdc) / BigInt(1e6));
        addBeats(beatsToAdd);
      }
      setAmount("");
    } catch (err) {
      console.error("Deposit failed:", err);
    } finally {
      setIsDepositing(false);
    }
  };

  const handleMintTestUsdc = async () => {
    if (!address) return;
    try {
      await mintUsdc({
        functionName: "mint",
        args: [address, parseUnits("1000", 6)], // Mint 1000 USDC for testing
      });
    } catch (err) {
      console.error("Mint failed:", err);
    }
  };

  const beatsToReceive = beatsPerUsdc && parsedAmount > 0
    ? (parsedAmount * beatsPerUsdc) / BigInt(1e6) // Convert from USDC decimals
    : BigInt(0);

  if (!isConnected) {
    return (
      <div className="flex flex-col min-h-screen">
        <BeatStreamNav />
        <div className="flex flex-col items-center justify-center flex-1 p-8">
          <h1 className="text-4xl font-bold mb-4">💰 Deposit USDC</h1>
          <p className="text-lg text-base-content/60 mb-8">Connect your wallet to deposit USDC and get Beats</p>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <BeatStreamNav />
      <div className="flex flex-col items-center flex-1 p-8">
      <div className="max-w-md w-full">
        <h1 className="text-4xl font-bold mb-2 text-center">💰 Deposit USDC</h1>
        <p className="text-base-content/60 mb-8 text-center">
          Convert USDC to Beats for streaming
        </p>

        {/* Balances Card */}
        <div className="bg-base-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-base-content/60">USDC Balance:</span>
            <span className="font-bold">
              {usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : "..."} USDC
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-base-content/60">Current Beats:</span>
            <span className="font-bold text-primary">
              {currentDeposit !== undefined ? currentDeposit.toString() : "..."} 🎵
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Rate:</span>
            <span className="font-bold">
              1 USDC = {beatsPerUsdc?.toString() || "..."} Beats
            </span>
          </div>
        </div>

        {/* Test USDC Button (for demo) */}
        <button
          onClick={handleMintTestUsdc}
          className="btn btn-outline btn-sm w-full mb-4"
        >
          🧪 Mint 1000 Test USDC (Demo Only)
        </button>

        {/* Amount Input */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text">Amount to Deposit</span>
            <span className="label-text-alt">
              <button
                className="link link-primary"
                onClick={() => usdcBalance && setAmount(formatUnits(usdcBalance, 6))}
              >
                Max
              </button>
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              className="input input-bordered w-full pr-16"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/60">
              USDC
            </span>
          </div>
        </div>

        {/* Conversion Preview */}
        {parsedAmount > 0 && (
          <div className="bg-primary/10 rounded-lg p-4 mb-6 text-center">
            <div className="text-sm text-base-content/60">You will receive</div>
            <div className="text-2xl font-bold text-primary">
              {beatsToReceive.toString()} Beats 🎵
            </div>
          </div>
        )}

        {/* Error States */}
        {amount && !hasEnoughBalance && (
          <div className="alert alert-error mb-4">
            <span>Insufficient USDC balance</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {needsApproval ? (
            <button
              onClick={handleApprove}
              className="btn btn-secondary w-full"
              disabled={!amount || !hasEnoughBalance || isApproving}
            >
              {isApproving ? (
                <span className="loading loading-spinner"></span>
              ) : (
                `Approve ${amount} USDC`
              )}
            </button>
          ) : (
            <button
              onClick={handleDeposit}
              className="btn btn-primary w-full"
              disabled={!amount || !hasEnoughBalance || isDepositing || parsedAmount === BigInt(0)}
            >
              {isDepositing ? (
                <span className="loading loading-spinner"></span>
              ) : (
                `Deposit & Get Beats`
              )}
            </button>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <a href="/beatstream" className="link link-primary">
            ← Back to BeatStream
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}
