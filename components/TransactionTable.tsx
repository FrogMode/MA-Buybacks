"use client";

import { useState, useEffect } from "react";
import { ExternalLink, ArrowUpRight, RefreshCw } from "lucide-react";
import { fetchTransactions } from "@/lib/api";
import { BuybackTransaction } from "@/types";

export function TransactionTable() {
  const [transactions, setTransactions] = useState<BuybackTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function loadTransactions(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetchTransactions(page, 10);
      if (response.error) {
        setError(response.error);
      } else {
        setTransactions(response.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTransactions();
    // Refresh every 30 seconds
    const interval = setInterval(() => loadTransactions(), 30000);
    return () => clearInterval(interval);
  }, [page]);

  const formatHash = (hash: string) => {
    if (!hash) return "—";
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  const getExplorerUrl = (hash: string) => {
    return `https://explorer.movementnetwork.xyz/txn/${hash}`;
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
          <p className="text-white/50 text-xs">Loading buyback transactions...</p>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
          <p className="text-white/50 text-xs">Latest buyback transactions onchain</p>
        </div>
        <button
          onClick={() => loadTransactions(true)}
          disabled={refreshing}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/50 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {transactions.length === 0 && !error ? (
        <div className="text-center py-8">
          <p className="text-white/50">No buyback transactions found</p>
          <p className="text-white/30 text-sm mt-1">
            Transactions will appear here once the indexer starts tracking
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-white/50 font-medium text-xs">
                  Hash
                </th>
                <th className="text-left py-2 px-3 text-white/50 font-medium text-xs">
                  Time
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium text-xs">
                  Tokens
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium text-xs">
                  Value
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium text-xs">
                  Price
                </th>
                <th className="text-center py-2 px-3 text-white/50 font-medium text-xs">
                  Status
                </th>
                <th className="text-center py-2 px-3 text-white/50 font-medium text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.hash}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <code className="text-movement-yellow text-xs font-mono bg-movement-yellow/10 px-2 py-0.5 rounded">
                      {formatHash(tx.hash)}
                    </code>
                  </td>
                  <td className="py-2.5 px-3 text-white/60 text-xs">
                    {getTimeAgo(tx.timestamp)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white text-sm font-medium">
                    {tx.tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white text-sm font-medium">
                    ${tx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white/60 text-sm">
                    ${tx.price.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-movement-yellow/10 text-movement-yellow border border-movement-yellow/20"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <a
                      href={getExplorerUrl(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded inline-block"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-white/40">
          Showing {transactions.length} recent transactions
        </p>
        <button className="text-xs text-white hover:text-movement-yellow transition-colors flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-white/5">
          View All
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
