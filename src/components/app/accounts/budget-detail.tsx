"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { type Budget, type BudgetLine } from "@/lib/db/schema";
import { saveBudgetLinesAction, updateBudgetStatusAction } from "@/server/actions/budgets";

type Acct = { id: string; code: string; name: string; type: string };

function monthLabel(m: string) {
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return names[parseInt(m) - 1] ?? m;
}

export function BudgetDetail({
  budget,
  lines,
  accounts,
  canUpdate,
}: {
  budget: Budget;
  lines: BudgetLine[];
  accounts: Acct[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Derive year from fiscalYear "YYYY-YY" — first 4 chars
  const baseYear = parseInt(budget.fiscalYear.slice(0, 4));
  // Months for this fiscal year (assume July start if year is e.g. 2026-27)
  const yearMonths = [7,8,9,10,11,12,1,2,3,4,5,6].map((m) => {
    const y = m >= 7 ? baseYear : baseYear + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });

  // Local grid state: Map<accountId+periodMonth, amount>
  const initialGrid = new Map(lines.map((l) => [`${l.accountId}|${l.periodMonth}`, l.amount]));
  const [grid, setGrid] = useState<Map<string, string>>(initialGrid);

  // Accounts selected for this budget (from existing lines or new additions)
  const usedAccountIds = new Set(lines.map((l) => l.accountId));
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(usedAccountIds);
  const [addAcct, setAddAcct] = useState("");

  function cellKey(accountId: string, month: string) { return `${accountId}|${month}`; }
  function cellValue(accountId: string, month: string) { return grid.get(cellKey(accountId, month)) ?? "0"; }

  function setCell(accountId: string, month: string, val: string) {
    setGrid((prev) => { const n = new Map(prev); n.set(cellKey(accountId, month), val); return n; });
  }

  function addAccount() {
    if (addAcct && !selectedAccountIds.has(addAcct)) {
      setSelectedAccountIds((prev) => new Set(prev).add(addAcct));
      setAddAcct("");
    }
  }

  function rowTotal(accountId: string) {
    return yearMonths.reduce((sum, m) => sum + parseFloat(cellValue(accountId, m) || "0"), 0);
  }

  function colTotal(month: string) {
    return [...selectedAccountIds].reduce((sum, aid) => sum + parseFloat(cellValue(aid, month) || "0"), 0);
  }

  function grandTotal() {
    return [...selectedAccountIds].reduce((sum, aid) => sum + rowTotal(aid), 0);
  }

  async function handleSave() {
    setSaving(true);
    const linesToSave: { accountId: string; periodMonth: string; amount: string }[] = [];
    for (const accountId of selectedAccountIds) {
      for (const month of yearMonths) {
        const amount = cellValue(accountId, month);
        if (parseFloat(amount) !== 0) {
          linesToSave.push({ accountId, periodMonth: month, amount });
        }
      }
    }
    if (linesToSave.length === 0) { toast.error("No non-zero amounts to save."); setSaving(false); return; }

    const fd = new FormData();
    fd.set("lines", JSON.stringify({ budgetId: budget.id, lines: linesToSave }));
    try {
      const res = await saveBudgetLinesAction(null, fd);
      if (!res.success) toast.error(res.error ?? "Failed.");
      else { toast.success("Budget lines saved."); router.refresh(); }
    } catch { toast.error("Unexpected error."); }
    finally { setSaving(false); }
  }

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.has(a.id));
  const availableToAdd = accounts.filter((a) => !selectedAccountIds.has(a.id));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{budget.name}</h1>
          <p className="text-sm text-muted-foreground">FY {budget.fiscalYear} · Status: <span className="font-medium">{budget.status}</span></p>
        </div>
        {canUpdate && budget.status === "draft" && (
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded disabled:opacity-60">
            {saving ? "Saving…" : "Save Lines"}
          </button>
        )}
      </div>

      {canUpdate && budget.status === "draft" && (
        <div className="flex gap-2 items-center">
          <select value={addAcct} onChange={(e) => setAddAcct(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">Add account…</option>
            {availableToAdd.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          <button onClick={addAccount} disabled={!addAcct} className="px-2 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50">Add</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2 font-medium min-w-[200px]">Account</th>
              {yearMonths.map((m) => (
                <th key={m} className="text-right py-2 px-2 font-medium min-w-[80px]">{monthLabel(m.slice(5))}</th>
              ))}
              <th className="text-right py-2 px-2 font-medium min-w-[90px]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {selectedAccounts.length === 0 && (
              <tr><td colSpan={yearMonths.length + 2} className="py-6 text-center text-muted-foreground">No accounts added yet.</td></tr>
            )}
            {selectedAccounts.map((a) => (
              <tr key={a.id} className="hover:bg-muted/20">
                <td className="py-1.5 px-2 font-medium">{a.code} {a.name}</td>
                {yearMonths.map((m) => (
                  <td key={m} className="py-1.5 px-1">
                    {budget.status === "draft" && canUpdate ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cellValue(a.id, m)}
                        onChange={(e) => setCell(a.id, m, e.target.value)}
                        className="w-full text-right border rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      <span className="block text-right">{parseFloat(cellValue(a.id, m)).toLocaleString()}</span>
                    )}
                  </td>
                ))}
                <td className="py-1.5 px-2 text-right font-medium">{rowTotal(a.id).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="py-2 px-2">Total</td>
              {yearMonths.map((m) => (
                <td key={m} className="py-2 px-2 text-right">{colTotal(m).toLocaleString()}</td>
              ))}
              <td className="py-2 px-2 text-right">{grandTotal().toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
