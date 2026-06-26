"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";

type DeptRow = {
  departmentId: string;
  departmentName: string;
  total: number;
  lineCount: number;
};

type BudgetRef = { id: string; name: string; fiscalYear: string; status: string };

export function DepartmentBudgets({
  rows,
  budgets,
  selectedBudgetId,
}: {
  rows: DeptRow[];
  budgets: BudgetRef[];
  selectedBudgetId: string;
}) {
  const router = useRouter();

  function updateBudget(id: string) {
    router.push(`/app/accounts/department-budgets?budget=${id}` as Route);
  }

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  function fmt(n: number) { return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Department Budgets</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Budget</label>
          <select value={selectedBudgetId} onChange={(e) => updateBudget(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            {budgets.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.fiscalYear})</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No department budget lines found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs">
              <th className="pb-2 font-medium">Department</th>
              <th className="pb-2 font-medium text-right">Budget Lines</th>
              <th className="pb-2 font-medium text-right">Total Budget</th>
              <th className="pb-2 font-medium text-right">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.departmentId} className="hover:bg-muted/20">
                <td className="py-2 pr-4 font-medium">{r.departmentName}</td>
                <td className="py-2 pr-4 text-right text-muted-foreground">{r.lineCount}</td>
                <td className="py-2 pr-4 text-right">{fmt(r.total)}</td>
                <td className="py-2 text-right text-xs text-muted-foreground">
                  {grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold bg-muted/20">
              <td className="py-2">Total</td>
              <td className="py-2 text-right text-muted-foreground">{rows.reduce((s, r) => s + r.lineCount, 0)}</td>
              <td className="py-2 text-right">{fmt(grandTotal)}</td>
              <td className="py-2 text-right text-xs">100.0%</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
