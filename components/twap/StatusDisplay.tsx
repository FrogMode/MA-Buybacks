"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletDropdown } from "./WalletDropdown";

export function StatusDisplay() {
  const { connected } = useWallet();

  return (
    <div className="flex items-center gap-4">
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
        <span className="text-sm text-emerald-400 font-medium">
          {connected ? "Connected" : "Live"}
        </span>
      </div>
      <WalletDropdown />
    </div>
  );
}
