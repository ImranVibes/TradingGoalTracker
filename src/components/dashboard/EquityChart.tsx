"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";

interface EquityChartProps {
  data: {
    date: string;
    cumulative_pnl: number;
    daily_pnl: number;
  }[];
}

export const EquityChart: React.FC<EquityChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
        <p className="text-sm text-slate-400 font-medium">No closed trade data yet.</p>
        <p className="text-xs text-slate-500 mt-1">
          Log your trades to watch your real-time cumulative equity curve generate.
        </p>
      </div>
    );
  }

  const latestEquity = data[data.length - 1]?.cumulative_pnl || 0;
  const isPositive = latestEquity >= 0;

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={isPositive ? "#10b981" : "#f43f5e"}
                stopOpacity={0.35}
              />
              <stop
                offset="95%"
                stopColor={isPositive ? "#10b981" : "#f43f5e"}
                stopOpacity={0.0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            tickFormatter={(val) => formatDate(val)}
            minTickGap={20}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            tickFormatter={(val) => `$${val}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                    <p className="text-xs text-slate-400 mb-1 font-mono">{formatDate(item.date)}</p>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-300">Cumulative PnL:</span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          item.cumulative_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(item.cumulative_pnl, true)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 mt-0.5">
                      <span className="text-xs text-slate-400">Day PnL:</span>
                      <span
                        className={`text-xs font-mono font-semibold ${
                          item.daily_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(item.daily_pnl, true)}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative_pnl"
            stroke={isPositive ? "#10b981" : "#f43f5e"}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
