"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export type MonthlyPoint = { month: string; revenue: number; expenses: number };

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y!), parseInt(m!) - 1, 1).toLocaleDateString("en", { month: "short" });
}

function fmtPkr(v: number): string {
  if (v >= 1_000_000) return `PKR ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `PKR ${(v / 1_000).toFixed(0)}K`;
  return `PKR ${v.toFixed(0)}`;
}

export function RevenueChart({ data }: { data: MonthlyPoint[] }) {
  const display = data.map((d) => ({ ...d, month: shortMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={display} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#dc2626" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: number) => `${(v / 1_000).toFixed(0)}K`}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v, name) => [fmtPkr(Number(v)), String(name)]}
          contentStyle={{
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--popover)",
            color: "var(--popover-foreground)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#16a34a"
          fill="url(#gradRevenue)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="#dc2626"
          fill="url(#gradExpenses)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
