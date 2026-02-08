"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBeats } from "./BeatsContext";

export function BeatStreamNav() {
  const pathname = usePathname();
  const { beatsBalance, isLowOnBeats, isOutOfBeats } = useBeats();

  const isActive = (path: string) => {
    if (path === "/beatstream") {
      return pathname === "/beatstream" || pathname === "/";
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="bg-base-200 border-b border-base-content/10 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/beatstream" className="text-xl font-bold">
          🎵 BeatStream
        </Link>
        <nav className="flex gap-2">
          <Link 
            href="/beatstream" 
            className={`btn btn-sm ${isActive("/beatstream") && !isActive("/beatstream/deposit") && !isActive("/beatstream/dashboard") ? "btn-active" : "btn-ghost"}`}
          >
            🎧 Listen
          </Link>
          <Link 
            href="/beatstream/deposit" 
            className={`btn btn-sm ${isActive("/beatstream/deposit") ? "btn-active btn-primary" : "btn-primary"}`}
          >
            💰 Top Up
          </Link>
          <Link 
            href="/beatstream/dashboard" 
            className={`btn btn-sm ${isActive("/beatstream/dashboard") ? "btn-active" : "btn-ghost"}`}
          >
            📊 Dashboard
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          isOutOfBeats ? "bg-error text-error-content" : 
          isLowOnBeats ? "bg-warning text-warning-content" : 
          "bg-success/20 text-success"
        }`}>
          {beatsBalance.toLocaleString()} Beats 🎵
        </div>
      </div>
    </div>
  );
}
