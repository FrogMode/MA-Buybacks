"use client";

import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function BuybackChart() {
  // Mock data - will be replaced with API data
  const data = [
    { date: "Jan 1", amount: 45000, value: 125000 },
    { date: "Jan 2", amount: 52000, value: 145000 },
    { date: "Jan 3", amount: 48000, value: 135000 },
    { date: "Jan 4", amount: 61000, value: 172000 },
    { date: "Jan 5", amount: 55000, value: 156000 },
    { date: "Jan 6", amount: 67000, value: 189000 },
    { date: "Jan 7", amount: 72000, value: 203000 },
    { date: "Jan 8", amount: 69000, value: 195000 },
    { date: "Jan 9", amount: 78000, value: 221000 },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-movement-dark-800 border border-movement-teal-500/30 rounded-lg p-3 shadow-xl backdrop-blur-sm">
          <p className="text-movement-dark-200 text-sm mb-2">{payload[0].payload.date}</p>
          <p className="text-movement-teal-400 text-sm font-medium">
            Tokens: {payload[0].value.toLocaleString()}
          </p>
          <p className="text-movement-yellow-400 text-sm font-medium">
            Value: ${payload[1].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-movement-dark-800/60 backdrop-blur-sm border border-movement-teal-500/20 rounded-xl p-6 shadow-lg shadow-movement-teal-500/5">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Buyback Activity</h2>
        <p className="text-movement-dark-300 text-sm">Historical buyback trends over time</p>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00D9C0" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00D9C0" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFC700" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#FFC700" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D3750" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#7F8799"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#7F8799"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#00D9C0"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAmount)"
              name="Tokens Bought"
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#FFC700"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
              name="USD Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
