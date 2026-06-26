"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";

type CostRow = {
  source: string | null;
  accountCode: string;
  accountName: string;
  totalDebit: string;
};

type TrendRow = {
  month: string;
  source: string | null;
  totalDebit: string;
};

const SOURCE_LABELS: Record<string, string> = {
  fleet: "Fleet",
  rm: "Maintenance",
  payroll: "Payroll",
};

function formatAmount(v: string | number) {
  return parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export function CostDashboardView({
  selectedMonth,
  costRows,
  trendRows,
}: {
  selectedMonth: string;
  costRows: CostRow[];
  trendRows: TrendRow[];
}) {
  const router = useRouter();

  function onMonthChange(m: string) {
    router.push(`/app/accounts/cost-dashboard?month=${m}` as Route);
  }

  // Group cost rows by source
  const bySource = new Map<string, CostRow[]>();
  for (const row of costRows) {
    const src = row.source ?? "other";
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src)!.push(row);
  }

  // Source totals for selected month
  const sourceTotals = Array.from(bySource.entries()).map(([src, rows]) => ({
    source: src,
    total: rows.reduce((s, r) => s + parseFloat(r.totalDebit), 0),
  }));
  const grandTotal = sourceTotals.reduce((s, r) => s + r.total, 0);

  // 6-month trend by month
  const allMonths = [...new Set(trendRows.map((r) => r.month))].sort();
  const allSources = ["fleet", "rm", "payroll"];

  return (
    <div className="space-y-8">
      {/* Month picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Month</label>
        <input
          type="month"
          defaultValue={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sourceTotals.map(({ source, total }) => (
          <div key={source} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {SOURCE_LABELS[source] ?? source}
            </p>
            <p className="text-2xl font-semibold mt-1">{formatAmount(total)}</p>
          </div>
        ))}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-semibold mt-1">{formatAmount(grandTotal)}</p>
        </div>
      </div>

      {/* Cost breakdown by source */}
      {Array.from(bySource.entries()).map(([src, rows]) => (
        <section key={src}>
          <h2 className="text-base font-semibold mb-3">
            {SOURCE_LABELS[src] ?? src} — Detail
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Account</th>
                  <th className="text-right px-4 py-2 font-medium">Debit (Expense)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.accountCode} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{row.accountCode}</span>
                      {row.accountName}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatAmount(row.totalDebit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-4 py-2 font-medium">Subtotal</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {formatAmount(rows.reduce((s, r) => s + parseFloat(r.totalDebit), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}

      {costRows.length === 0 && (
        <p className="text-sm text-muted-foreground">No operational costs posted to GL for the selected month.</p>
      )}

      {/* 6-month trend table */}
      {trendRows.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">6-Month Trend</h2>
          <div className="rounded-lg border overflow-auto">
            <table className="text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Month</th>
                  {allSources.map((s) => (
                    <th key={s} className="text-right px-4 py-2 font-medium">
                      {SOURCE_LABELS[s] ?? s}
                    </th>
                  ))}
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allMonths.map((month) => {
                  const bySource = Object.fromEntries(
                    trendRows
                      .filter((r) => r.month === month)
                      .map((r) => [r.source ?? "other", parseFloat(r.totalDebit)])
                  );
                  const rowTotal = allSources.reduce((s, src) => s + (bySource[src] ?? 0), 0);
                  return (
                    <tr key={month} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{month}</td>
                      {allSources.map((s) => (
                        <td key={s} className="px-4 py-2 text-right tabular-nums">
                          {bySource[s] != null ? formatAmount(bySource[s]) : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatAmount(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
