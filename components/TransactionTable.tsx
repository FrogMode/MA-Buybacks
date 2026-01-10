"use client";

import { ExternalLink, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  hash: string;
  timestamp: Date;
  tokens: number;
  value: number;
  price: number;
  status: "confirmed" | "pending";
}

export function TransactionTable() {
  // Mock data - will be replaced with API data
  const transactions: Transaction[] = [
    {
      hash: "0x1a2b3c4d5e6f7g8h9i0j",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      tokens: 124500,
      value: 352000,
      price: 2.83,
      status: "confirmed",
    },
    {
      hash: "0x9j8i7h6g5f4e3d2c1b0a",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      tokens: 98200,
      value: 276000,
      price: 2.81,
      status: "confirmed",
    },
    {
      hash: "0xa1b2c3d4e5f6g7h8i9j0",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      tokens: 156800,
      value: 438000,
      price: 2.79,
      status: "confirmed",
    },
    {
      hash: "0x0j9i8h7g6f5e4d3c2b1a",
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      tokens: 87300,
      value: 243000,
      price: 2.78,
      status: "confirmed",
    },
    {
      hash: "0xf1e2d3c4b5a6978685746",
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
      tokens: 203400,
      value: 562000,
      price: 2.76,
      status: "confirmed",
    },
  ];

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getTimeAgo = (date: Date) => {
    const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return "< 1 hour ago";
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
        <p className="text-white/50 text-xs">Latest buyback transactions onchain</p>
      </div>

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
              <th className="text-center py-2 px-3 text-white/50 font-medium text-xs">

              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
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
                  {tx.tokens.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right text-white text-sm font-medium">
                  ${tx.value.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right text-white/60 text-sm">
                  ${tx.price.toFixed(2)}
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
                  <button className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
