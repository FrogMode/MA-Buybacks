"use client";

import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Activity, Clock } from "lucide-react";
import { fetchBuybackStats } from "@/lib/api";
import { BuybackStats } from "@/types";

export function StatsCards() {
  const [stats, setStats] = useState<BuybackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetchBuybackStats();
        if (response.error) {
          setError(response.error);
        } else {
          setStats(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
    // Refresh every 60 seconds
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const getTimeAgo = (date: Date) => {
    // Check for invalid date or epoch (no buybacks)
    if (!date || isNaN(date.getTime()) || date.getTime() === 0) {
      return "No buybacks yet";
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // If date is in the future or invalid, return placeholder
    if (diffMs < 0) return "No buybacks yet";
    
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

  const formatPercentage = (value: number) => {
    if (value === 0) return null;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const statsData = stats
    ? [
        {
          title: "Total Buybacks",
          value: `$${stats.totalBuybacksUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
          change: formatPercentage(stats.percentageChange24h.buybacks),
          icon: DollarSign,
          trend: stats.percentageChange24h.buybacks >= 0 ? "up" : "down",
        },
        {
          title: "Total Tokens",
          value: stats.totalTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          change: formatPercentage(stats.percentageChange24h.tokens),
          icon: TrendingUp,
          trend: stats.percentageChange24h.tokens >= 0 ? "up" : "down",
        },
        {
          title: "Transactions",
          value: stats.transactionCount.toLocaleString(),
          change: formatPercentage(stats.percentageChange24h.transactions),
          icon: Activity,
          trend: stats.percentageChange24h.transactions >= 0 ? "up" : "down",
        },
        {
          title: "Last Buyback",
          value: getTimeAgo(new Date(stats.lastBuybackTime)),
          change: `${stats.lastBuybackAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens`,
          icon: Clock,
          trend: "neutral" as const,
        },
      ]
    : [
        { title: "Total Buybacks", value: "—", change: null, icon: DollarSign, trend: "neutral" as const },
        { title: "Total Tokens", value: "—", change: null, icon: TrendingUp, trend: "neutral" as const },
        { title: "Transactions", value: "—", change: null, icon: Activity, trend: "neutral" as const },
        { title: "Last Buyback", value: "—", change: null, icon: Clock, trend: "neutral" as const },
      ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`glass rounded-xl p-4 hover:bg-white/[0.06] transition-all duration-300 group ${
              loading ? "animate-pulse" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-movement-yellow/10 rounded-lg group-hover:bg-movement-yellow/20 transition-colors">
                <Icon className="w-4 h-4 text-movement-yellow" />
              </div>
              {stat.change && stat.trend !== "neutral" && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    stat.trend === "up"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {stat.change}
                </span>
              )}
            </div>
            <h3 className="text-white/50 text-xs mb-0.5">{stat.title}</h3>
            <p className="text-xl font-bold text-white">{stat.value}</p>
            {stat.trend === "neutral" && stat.change && (
              <p className="text-xs text-white/40">{stat.change}</p>
            )}
          </div>
        );
      })}
      {error && (
        <div className="col-span-full text-center text-red-400 text-sm py-2">
          {error}
        </div>
      )}
    </div>
  );
}
