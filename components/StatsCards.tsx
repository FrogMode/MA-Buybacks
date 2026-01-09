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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-movement-dark-800/60 backdrop-blur-sm border border-movement-teal-500/20 rounded-xl p-6 hover:border-movement-teal-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-movement-teal-500/20 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-gradient-to-br from-movement-teal-500/20 to-movement-yellow-500/20 rounded-lg group-hover:from-movement-teal-500/30 group-hover:to-movement-yellow-500/30 transition-all">
                <Icon className="w-5 h-5 text-movement-teal-400" />
              </div>
              {stat.trend !== "neutral" && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    stat.trend === "up"
                      ? "bg-movement-teal-500/20 text-movement-teal-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {stat.change}
                </span>
              )}
            </div>
            <h3 className="text-movement-dark-300 text-sm mb-1">{stat.title}</h3>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            {stat.trend === "neutral" && (
              <p className="text-xs text-movement-dark-400 mt-1">{stat.change}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
