"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { RefreshCw } from "lucide-react";
import type { TokenBalances } from "@/types/twap";

interface BalanceDisplayProps {
  onBalanceUpdate?: (balances: TokenBalances) => void;
}

// Movement Mainnet Indexer GraphQL endpoint
const INDEXER_URL = "https://indexer.mainnet.movementnetwork.xyz/v1/graphql";

// Token identifiers for fungible assets
const MOVE_ASSET = "0x1::aptos_coin::AptosCoin";
const USDC_ASSETS = [
  "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b::usdc::USDC", // Native USDC
  "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39", // USDC.e fungible asset
];

export function BalanceDisplay({ onBalanceUpdate }: BalanceDisplayProps) {
  const { account, connected } = useWallet();
  const [balances, setBalances] = useState<TokenBalances | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = account?.address?.toString();

  const fetchBalances = useCallback(async () => {
    if (!address) {
      console.log("No address available");
      return;
    }

    setIsRefreshing(true);
    setError(null);
    
    try {
      // Use GraphQL indexer to fetch fungible asset balances
      const query = `
        query GetBalances($address: String!) {
          current_fungible_asset_balances(
            where: { owner_address: { _eq: $address } }
          ) {
            asset_type
            amount
            metadata {
              name
              symbol
              decimals
            }
          }
        }
      `;

      const response = await fetch(INDEXER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { address },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || "GraphQL error");
      }

      const assetBalances = result.data?.current_fungible_asset_balances || [];
      
      let moveBalance = 0;
      let usdcBalance = 0;

      for (const asset of assetBalances) {
        const assetType = asset.asset_type;
        const amount = parseInt(asset.amount, 10);
        const decimals = asset.metadata?.decimals || 8;

        // Check for MOVE
        if (assetType === MOVE_ASSET) {
          moveBalance = amount / Math.pow(10, decimals);
        }
        
        // Check for USDC (any variant)
        if (USDC_ASSETS.includes(assetType) || 
            asset.metadata?.symbol?.toUpperCase().includes("USDC")) {
          usdcBalance += amount / Math.pow(10, decimals);
        }
      }

      const newBalances = {
        MOVE: moveBalance,
        USDC: usdcBalance,
      };

      setBalances(newBalances);
      onBalanceUpdate?.(newBalances);
    } catch (err) {
      console.error("Error fetching balances:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
    } finally {
      setIsRefreshing(false);
    }
  }, [address, onBalanceUpdate]);

  useEffect(() => {
    if (connected && address) {
      fetchBalances();
    }
  }, [connected, address, fetchBalances]);

  if (!connected || !address) {
    return (
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gradient mb-4">Balances</h2>
        <p className="text-white/50 text-sm">
          Connect your wallet to view balances
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gradient">Balances</h2>
        <button
          onClick={fetchBalances}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 glass-subtle rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-subtle rounded-xl p-4">
          <p className="text-white/50 text-sm mb-1">USDC</p>
          <p className="text-2xl font-bold text-white">
            {balances
              ? balances.USDC.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "--"}
          </p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <p className="text-white/50 text-sm mb-1">MOVE</p>
          <p className="text-2xl font-bold text-movement-yellow">
            {balances
              ? balances.MOVE.toLocaleString(undefined, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })
              : "--"}
          </p>
        </div>
      </div>

      {address && (
        <p className="text-white/30 text-xs mt-3 truncate">
          Wallet: {address}
        </p>
      )}
    </div>
  );
}
