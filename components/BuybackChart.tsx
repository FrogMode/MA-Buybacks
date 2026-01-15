"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fetchChartData } from "@/lib/api";
import { ChartDataPoint } from "@/types";

type Timeframe = "24h" | "7d" | "30d" | "all";

export function BuybackChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");

  useEffect(() => {
    async function loadChartData() {
      setLoading(true);
      try {
        const response = await fetchChartData(timeframe);
        if (response.error) {
          setError(response.error);
        } else {
          setData(response.data);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chart data");
      } finally {
        setLoading(false);
      }
    }

    loadChartData();
    // Refresh every 5 minutes
    const interval = setInterval(loadChartData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (timeframe === "24h") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-xl p-4 shadow-2xl">
          <p className="text-white font-medium mb-2">
            {formatDate(payload[0].payload.date)}
          </p>
          <p className="text-movement-yellow text-sm">
            Tokens:{" "}
            <span className="font-semibold">
              {payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
          <p className="text-white/60 text-sm">
            Value:{" "}
            <span className="font-semibold">
              ${payload[1].value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: "24h", label: "24H" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Buyback Activity</h2>
          <p className="text-white/50 text-xs">Historical buyback trends over time</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeframe(option.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                timeframe === option.value
                  ? "bg-movement-yellow text-black"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="h-[280px] w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-pulse text-white/50">Loading chart data...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-white/50">No data available</p>
              <p className="text-white/30 text-sm mt-1">
                Chart will populate once buybacks are indexed
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFDA00" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#FFDA00" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#FFDA00" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity={0.05} />
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.3)"
                style={{ fontSize: "12px" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDate}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                style={{ fontSize: "12px" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="line"
                formatter={(value) => (
                  <span className="text-white/70 text-sm">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#FFDA00"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAmount)"
                name="Tokens Bought"
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
                name="USD Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
