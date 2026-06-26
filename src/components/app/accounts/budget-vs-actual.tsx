"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { exportToCsv } from "@/lib/utils/export-csv";

type BvaRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePct: number;
};

type BudgetRef = { id: string; name: string; fiscalYear: string; status: string };

export function BudgetVsActual({
  rows,
  budgets,
  selectedBudgetId,
  fromMonth,
  toMonth,
}: {
  rows: BvaRow[];
  budgets: BudgetRef[];
  selectedBudgetId: string;
  fromMonth: string;
  toMonth: string;
}) {
  const router = useRouter();

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams({ budget: selectedBudgetId, from: fromMonth, to: toMonth, [key]: value });
    router.push(`/app/accounts/budget-vs-actual?${sp.toString()}` as Route);
  }

  function handleExport() {
    exportToCsv("budget-vs-actual.csv", rows, [
      { key: "accountCode", label: "Code" },
      { key: "accountName", label: "Account" },
      { key: "budgeted", label: "Budget" },
      { key: "actual", label: "Actual" },
      { key: "variance", label: "Variance" },
      { key: "variancePct", label: "Variance %" },
    ]);
  }

  const totalBudget = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalVariance = totalActual - totalBudget;

  function fmt(n: number) { return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Budget vs Actual</h1>
        <button onClick={handleExport} className="px-3 py-1.5 text-sm border rounded hover:bg-muted">Export CSV</button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Budget</label>
          <select value={selectedBudgetId} onChange={(e) => updateParam("budget", e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            {budgets.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.fiscalYear})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From Month</label>
          <input type="month" value={fromMonth} onChange={(e) => updateParam("from", e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To Month</label>
          <input type="month" value={toMonth} onChange={(e) => updateParam("to", e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No budget lines found for the selected period.</p>
      ) : (
        <>
          <div className="flex gap-4 text-sm">
            <div className="border rounded p-3 min-w-[140px]"><p className="text-muted-foreground text-xs">Total Budget</p><p className="font-semibold text-base">{fmt(totalBudget)}</p></div>
            <div className="border rounded p-3 min-w-[140px]"><p className="text-muted-foreground text-xs">Total Actual</p><p className="font-semibold text-base">{fmt(totalActual)}</p></div>
            <div className={`border rounded p-3 min-w-[140px] ${totalVariance > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <p className="text-muted-foreground text-xs">Variance</p>
              <p className={`font-semibold text-base ${totalVariance > 0 ? "text-red-700" : "text-green-700"}`}>{totalVariance > 0 ? "+" : ""}{fmt(totalVariance)}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Account</th>
                <th className="pb-2 font-medium text-right">Budget</th>
                <th className="pb-2 font-medium text-right">Actual</th>
                <th className="pb-2 font-medium text-right">Variance</th>
                <th className="pb-2 font-medium text-right">Var %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const over = r.variance > 0;
                return (
                  <tr key={r.accountId} className={`hover:bg-muted/20 ${over ? "bg-red-50/50" : r.variance < -0.01 ? "bg-green-50/50" : ""}`}>
                    <td className="py-1.5 pr-3 text-xs text-muted-foreground">{r.accountCode}</td>
                    <td className="py-1.5 pr-3">{r.accountName}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(r.budgeted)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(r.actual)}</td>
                    <td className={`py-1.5 pr-3 text-right font-medium ${over ? "text-red-700" : "text-green-700"}`}>
                      {over ? "+" : ""}{fmt(r.variance)}
                    </td>
                    <td className={`py-1.5 text-right text-xs ${over ? "text-red-600" : "text-green-600"}`}>
                      {r.variancePct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold bg-muted/20 text-sm">
                <td colSpan={2} className="py-2">Total</td>
                <td className="py-2 text-right">{fmt(totalBudget)}</td>
                <td className="py-2 text-right">{fmt(totalActual)}</td>
                <td className={`py-2 text-right ${totalVariance > 0 ? "text-red-700" : "text-green-700"}`}>{totalVariance > 0 ? "+" : ""}{fmt(totalVariance)}</td>
                <td className="py-2 text-right text-xs">{totalBudget !== 0 ? ((totalVariance / Math.abs(totalBudget)) * 100).toFixed(1) : "—"}%</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
