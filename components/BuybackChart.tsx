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
        <div className="glass rounded-xl p-4 shadow-2xl">
          <p className="text-white font-medium mb-2">{payload[0].payload.date}</p>
          <p className="text-movement-yellow text-sm">
            Tokens: <span className="font-semibold">{payload[0].value.toLocaleString()}</span>
          </p>
          <p className="text-white/60 text-sm">
            Value: <span className="font-semibold">${payload[1].value.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Buyback Activity</h2>
        <p className="text-white/50 text-xs">Historical buyback trends over time</p>
      </div>

      <div className="h-[280px] w-full">
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
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
              formatter={(value) => <span className="text-white/70 text-sm">{value}</span>}
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
      </div>
    </div>
  );
}
