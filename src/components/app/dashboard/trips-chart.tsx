"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

export type TripPoint = { month: string; trips: number };

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y!), parseInt(m!) - 1, 1).toLocaleDateString("en", { month: "short" });
}

export function TripsChart({ data }: { data: TripPoint[] }) {
  const display = data.map((d) => ({ ...d, month: shortMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={display} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          formatter={(v) => [Number(v), "Trips"]}
          contentStyle={{
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--popover)",
            color: "var(--popover-foreground)",
          }}
        />
        <Bar dataKey="trips" name="Trips" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
