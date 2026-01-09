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
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Recent Transactions</h2>
        <p className="text-gray-400 text-sm">Latest buyback transactions onchain</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">
                Transaction Hash
              </th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">
                Time
              </th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">
                Tokens
              </th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">
                Value (USD)
              </th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">
                Price
              </th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">
                Status
              </th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">
                Explorer
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr
                key={tx.hash}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-4 px-4">
                  <code className="text-blue-400 text-sm font-mono">
                    {formatHash(tx.hash)}
                  </code>
                </td>
                <td className="py-4 px-4 text-gray-300 text-sm">
                  {getTimeAgo(tx.timestamp)}
                </td>
                <td className="py-4 px-4 text-right text-white font-medium">
                  {tx.tokens.toLocaleString()}
                </td>
                <td className="py-4 px-4 text-right text-white font-medium">
                  ${tx.value.toLocaleString()}
                </td>
                <td className="py-4 px-4 text-right text-gray-300">
                  ${tx.price.toFixed(2)}
                </td>
                <td className="py-4 px-4 text-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === "confirmed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {tx.status}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <button className="text-gray-400 hover:text-blue-400 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Showing {transactions.length} most recent transactions
        </p>
        <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
          View All
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
