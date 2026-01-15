"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import type { TradeExecution } from "@/types/twap";

interface TradeHistoryProps {
  trades: TradeExecution[];
  onRefresh: (trades: TradeExecution[]) => void;
}

export function TradeHistory({ trades, onRefresh }: TradeHistoryProps) {
  const { connected } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // In a real implementation, this would fetch from the API
      // For now, just simulate a refresh
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: TradeExecution["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "pending":
        return <Clock className="w-4 h-4 text-movement-yellow animate-pulse" />;
    }
  };

  const getStatusColor = (status: TradeExecution["status"]) => {
    switch (status) {
      case "success":
        return "text-emerald-400";
      case "failed":
        return "text-red-400";
      case "pending":
        return "text-movement-yellow";
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  if (!connected) {
    return (
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gradient mb-4">
          Trade History
        </h2>
        <p className="text-white/50 text-sm">
          Connect your wallet to view trade history
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gradient">Trade History</h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 glass-subtle rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/50 text-sm">No trades yet</p>
          <p className="text-white/30 text-xs mt-1">
            Start a TWAP session to see trades here
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {trades
            .slice()
            .reverse()
            .map((trade) => (
              <div
                key={trade.id}
                className="glass-subtle rounded-lg p-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(trade.status)}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {trade.amountIn.toFixed(2)} USDC →{" "}
                        {trade.amountOut.toFixed(4)} MOVE
                      </p>
                      <p className="text-xs text-white/50">
                        {formatDate(trade.timestamp)} at{" "}
                        {formatTime(trade.timestamp)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium capitalize ${getStatusColor(
                      trade.status
                    )}`}
                  >
                    {trade.status}
                  </span>
                </div>

                {trade.txHash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-white/40 font-mono truncate max-w-[200px]">
                      {trade.txHash}
                    </span>
                    <a
                      href={`https://explorer.movementnetwork.xyz/txn/${trade.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-movement-yellow hover:text-movement-yellow-light transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {trade.error && (
                  <p className="mt-2 text-xs text-red-400">{trade.error}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
