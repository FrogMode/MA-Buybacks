"use client";

import { TrendingUp, DollarSign, Activity, Clock } from "lucide-react";

export function StatsCards() {
  // Mock data - will be replaced with API data
  const stats = [
    {
      title: "Total Buybacks",
      value: "$2,458,392",
      change: "+12.5%",
      icon: DollarSign,
      trend: "up",
    },
    {
      title: "Total Tokens",
      value: "1,234,567",
      change: "+8.2%",
      icon: TrendingUp,
      trend: "up",
    },
    {
      title: "Transactions",
      value: "156",
      change: "+23.1%",
      icon: Activity,
      trend: "up",
    },
    {
      title: "Last Buyback",
      value: "2 hours ago",
      change: "124,500 tokens",
      icon: Clock,
      trend: "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="glass rounded-xl p-4 hover:bg-white/[0.06] transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-movement-yellow/10 rounded-lg group-hover:bg-movement-yellow/20 transition-colors">
                <Icon className="w-4 h-4 text-movement-yellow" />
              </div>
              {stat.trend !== "neutral" && (
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
            {stat.trend === "neutral" && (
              <p className="text-xs text-white/40">{stat.change}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
