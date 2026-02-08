"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

interface BeatsContextType {
  beatsBalance: number;
  setBeatsBalance: (balance: number) => void;
  decrementBeat: () => boolean; // Returns true if playback should stop (out of beats)
  addBeats: (amount: number) => void;
  refreshBalance: () => void;
  isLowOnBeats: boolean;
  isOutOfBeats: boolean;
  isLoading: boolean;
  isWalletConnected: boolean;
}

const LOW_BEATS_WARNING = 400;
const INITIAL_BEATS = 500; // Default for demo when no wallet connected
const USDC_PER_BEAT = 1000; // From contract: 1 Beat = 1000 USDC base units
const STORAGE_KEY_PREFIX = "beatstream_spent_";

const BeatsContext = createContext<BeatsContextType | null>(null);

// Helper to get/set spent beats from localStorage
function getSpentBeats(wallet: string): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`);
  return stored ? parseInt(stored, 10) : 0;
}

function setSpentBeats(wallet: string, spent: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`, spent.toString());
}

export function BeatsProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const [beatsBalance, setBeatsBalance] = useState(INITIAL_BEATS);
  const [beatsSpent, setBeatsSpent] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // Read user's deposit from the smart contract
  const { data: userDeposit, isLoading: isLoadingDeposit, refetch } = useScaffoldReadContract({
    contractName: "BeatStreamVault",
    functionName: "deposits",
    args: [address],
  });

  // Initialize spent beats from localStorage when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      const stored = getSpentBeats(address);
      setBeatsSpent(stored);
      setInitialized(true);
    } else {
      setBeatsSpent(0);
      setInitialized(false);
    }
  }, [isConnected, address]);

  // Calculate beats balance from contract deposit minus spent
  useEffect(() => {
    if (isConnected && userDeposit !== undefined && initialized) {
      // Convert USDC deposit to beats: deposit / USDC_PER_BEAT
      const contractBeats = Number(userDeposit) / USDC_PER_BEAT;
      const remaining = Math.max(0, contractBeats - beatsSpent);
      setBeatsBalance(remaining);
      console.log(`✅ Beats: ${contractBeats} deposited - ${beatsSpent} spent = ${remaining} remaining`);
    } else if (!isConnected) {
      // Demo mode when no wallet connected
      setBeatsBalance(INITIAL_BEATS);
    }
  }, [isConnected, userDeposit, beatsSpent, initialized]);

  const isLowOnBeats = beatsBalance < LOW_BEATS_WARNING && beatsBalance > 0;
  const isOutOfBeats = beatsBalance <= 0;

  // Decrement beat and persist to localStorage
  const decrementBeat = useCallback(() => {
    if (!address) return false;
    
    if (beatsBalance <= 1) {
      setBeatsBalance(0);
      const newSpent = beatsSpent + 1;
      setBeatsSpent(newSpent);
      setSpentBeats(address, newSpent);
      return true; // Should stop - out of beats
    }
    setBeatsBalance(prev => prev - 1);
    const newSpent = beatsSpent + 1;
    setBeatsSpent(newSpent);
    setSpentBeats(address, newSpent);
    return false; // Continue playing
  }, [address, beatsBalance, beatsSpent]);

  // Add beats (after deposit) - just refetch from contract
  // Don't reset spent counter - those beats were already consumed
  const addBeats = useCallback((_amount: number) => {
    // Refetch from contract to get updated balance
    refetch();
  }, [refetch]);

  // Refresh balance from contract
  const refreshBalance = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <BeatsContext.Provider
      value={{
        beatsBalance,
        setBeatsBalance,
        decrementBeat,
        addBeats,
        refreshBalance,
        isLowOnBeats,
        isOutOfBeats,
        isLoading: isLoadingDeposit || !initialized,
        isWalletConnected: isConnected,
      }}
    >
      {children}
    </BeatsContext.Provider>
  );
}

export function useBeats() {
  const context = useContext(BeatsContext);
  if (!context) {
    throw new Error("useBeats must be used within a BeatsProvider");
  }
  return context;
}
