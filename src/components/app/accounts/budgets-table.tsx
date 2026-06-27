"use client";

import { useActionState, useTransition, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";

import { PieChart } from "lucide-react";
import { type Budget } from "@/lib/db/schema";
import { createBudgetAction, updateBudgetStatusAction } from "@/server/actions/budgets";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_COLORS: Record<string, string> = {
  draft:  "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  closed: "bg-red-100 text-red-700",
};

export function BudgetsTable({
  budgets,
  canCreate,
  canUpdate,
}: {
  budgets: Budget[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const [state, formAction, isPending] = useActionState(createBudgetAction, null);

  function openDialog() { setDialogKey((k) => k + 1); setShowDialog(true); }

  function handleStatusChange(id: string, status: "active" | "closed" | "draft") {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const res = await updateBudgetStatusAction(id, status);
        if (!res.success) toast.error(res.error ?? "Failed.");
        else toast.success("Budget updated.");
      } catch { toast.error("Unexpected error."); }
      finally { setPendingIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); }
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Budgets</h1>
        <div className="flex gap-2">
          {canCreate && (
            <button onClick={openDialog} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md">
              New Budget
            </button>
          )}
          <Link href={"/app/accounts/budget-vs-actual" as Route} className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
            Budget vs Actual →
          </Link>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Fiscal Year</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Notes</th>
            <th className="pb-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {budgets.length === 0 && (
            <tr>
              <td colSpan={5} className="p-0">
                <EmptyState icon={PieChart} title="No budgets yet" description="Create a budget to plan and track department spending." />
              </td>
            </tr>
          )}
          {budgets.map((b) => (
            <tr key={b.id} className="hover:bg-muted/30">
              <td className="py-2 pr-4">
                <Link href={`/app/accounts/budgets/${b.id}` as Route} className="text-primary hover:underline font-medium">
                  {b.name}
                </Link>
              </td>
              <td className="py-2 pr-4">{b.fiscalYear}</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                  {b.status}
                </span>
              </td>
              <td className="py-2 pr-4 text-muted-foreground text-xs">{b.notes ?? "—"}</td>
              <td className="py-2 text-right space-x-2">
                {canUpdate && b.status === "draft" && (
                  <button
                    onClick={() => handleStatusChange(b.id, "active")}
                    disabled={pendingIds.has(b.id)}
                    className="text-xs px-2 py-1 border rounded hover:bg-muted disabled:opacity-50"
                  >
                    {pendingIds.has(b.id) ? "…" : "Activate"}
                  </button>
                )}
                {canUpdate && b.status === "active" && (
                  <button
                    onClick={() => handleStatusChange(b.id, "closed")}
                    disabled={pendingIds.has(b.id)}
                    className="text-xs px-2 py-1 border rounded hover:bg-muted disabled:opacity-50"
                  >
                    {pendingIds.has(b.id) ? "…" : "Close"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">New Budget</h2>
            <form key={dialogKey} action={formAction} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input name="name" required className="w-full border rounded px-3 py-1.5 text-sm" placeholder="FY 2026-27 Operating Budget" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fiscal Year</label>
                <input name="fiscalYear" required className="w-full border rounded px-3 py-1.5 text-sm" placeholder="2026-27" pattern="\d{4}-\d{2}" />
                <p className="text-xs text-muted-foreground mt-0.5">Format: YYYY-YY (e.g. 2026-27)</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              {state && !state.success && (
                <p className="text-sm text-red-600">{state.error}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowDialog(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
                <button type="submit" disabled={isPending} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded disabled:opacity-60">
                  {isPending ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
