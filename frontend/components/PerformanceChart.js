'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ETH turned into dividends per cycle (the common denominator across reward modes).
export default function PerformanceChart({ data }) {
  const chartData = data
    .map((e) => ({
      time: new Date(e.executionTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      eth: Number(e.claimedEth || 0) / 1e18,
      symbol: e.rewardSymbol || 'reward',
      holders: e.holderCount,
    }))
    .reverse();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="rounded-lg border border-line bg-paper p-3 shadow-soft">
          <p className="text-xs text-mut">{p.time}</p>
          <p className="figure text-sm font-semibold text-hood-700">{p.eth.toFixed(4)} ETH</p>
          <p className="text-xs text-mut">paid as {p.symbol} to {p.holders} holders</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorEth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C805" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#00C805" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5EBE6" />
          <XAxis dataKey="time" stroke="#8B95A4" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#8B95A4" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(3)} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00C805', strokeOpacity: 0.3 }} />
          <Area type="monotone" dataKey="eth" stroke="#00A804" strokeWidth={2} fillOpacity={1} fill="url(#colorEth)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
