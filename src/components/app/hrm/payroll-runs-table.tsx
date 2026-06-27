"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";

import { Banknote } from "lucide-react";
import { createPayrollRunAction } from "@/server/actions/hrm/payroll";
import type { PayrollRun } from "@/lib/db/schema";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  approved:   "bg-yellow-100 text-yellow-700",
  posted:     "bg-green-100 text-green-700",
  paid:       "bg-emerald-100 text-emerald-700",
};

type Props = { runs: PayrollRun[]; canRun: boolean };

export function PayrollRunsTable({ runs, canRun }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [state, formAction, isPending] = useActionState(createPayrollRunAction, null);

  if (state?.success === true && showForm) {
    toast.success("Payroll run created.");
    setShowForm(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payroll Runs</h1>
        {canRun && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setShowForm(true); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New Run
          </button>
        )}
      </div>

      {showForm && canRun && (
        <div className="rounded-lg border bg-card p-6 shadow-sm max-w-md">
          <h2 className="mb-4 text-lg font-medium">Create Payroll Run</h2>
          <form key={dialogKey} action={formAction} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Period Month *</label>
              <input
                type="date"
                name="periodMonth"
                required
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <p className="text-xs text-muted-foreground">Select any day in the payroll month (e.g. 2026-06-01 for June 2026)</p>
            </div>
            {state?.success === false && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Period</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total Gross</th>
              <th className="px-4 py-3 text-right font-medium">Total Net</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState icon={Banknote} title="No payroll runs yet" description="Run your first payroll to generate employee payslips." />
                </td>
              </tr>
            )}
            {runs.map((run) => (
              <tr key={run.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{run.periodMonth}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {parseFloat(run.totalGross ?? "0").toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right">
                  {parseFloat(run.totalNet ?? "0").toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(run.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/app/hrm/payroll/runs/${run.id}` as Route} className="text-xs text-primary hover:underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
