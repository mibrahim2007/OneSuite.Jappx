"use client";

import { useActionState, useTransition, useState } from "react";
import { toast } from "sonner";

import { generatePayslipsAction, postPayrollAction } from "@/server/actions/hrm/payroll";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { PayrollRun, Payslip } from "@/lib/db/schema";

type SlipRow = Pick<Payslip, "id" | "basic" | "allowances" | "deductions" | "tax" | "gross" | "net"> & {
  employeeName: string;
  empCode: string;
};

type AccountOption = { id: string; code: string; name: string };

type Props = {
  run: PayrollRun;
  payslips: SlipRow[];
  accounts: AccountOption[];
  canRun: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  approved:   "bg-yellow-100 text-yellow-700",
  posted:     "bg-green-100 text-green-700",
  paid:       "bg-emerald-100 text-emerald-700",
};

export function PayrollRunDetail({ run, payslips, accounts, canRun }: Props) {
  const [isGenerating, startGenerate] = useTransition();
  const [showPostForm, setShowPostForm] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const [postState, postAction, isPosting] = useActionState(postPayrollAction, null);

  if (postState?.success === true && showPostForm) {
    toast.success("Payroll posted to General Ledger.");
    setShowPostForm(false);
  }

  function handleGenerate() {
    startGenerate(async () => {
      const result = await generatePayslipsAction(run.id);
      if (result?.success === false) {
        toast.error(result.error);
      } else {
        toast.success("Payslips generated.");
      }
    });
  }

  const canGenerate = canRun && run.status === "draft";
  const canPost = canRun && (run.status === "processing" || run.status === "approved");
  const isPosted = run.status === "posted" || run.status === "paid";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll Run — {run.periodMonth}</h1>
          <div className="mt-1 flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[run.status] ?? ""}`}>
              {run.status}
            </span>
            <span className="text-sm text-muted-foreground">
              Gross: {parseFloat(run.totalGross ?? "0").toLocaleString("en-PK", { minimumFractionDigits: 2 })} |{" "}
              Net: {parseFloat(run.totalNet ?? "0").toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate Payslips"}
            </button>
          )}
          {canPost && !showPostForm && (
            <button
              onClick={() => { setDialogKey((k) => k + 1); setShowPostForm(true); }}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Post to GL
            </button>
          )}
          {isPosted && run.journalId && (
            <span className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Posted ✓
            </span>
          )}
        </div>
      </div>

      {showPostForm && canPost && (
        <div className="rounded-lg border bg-card p-6 shadow-sm max-w-lg">
          <h2 className="mb-4 text-lg font-medium">Post Payroll to GL</h2>
          <form key={dialogKey} action={postAction} className="space-y-4">
            <input type="hidden" name="runId" value={run.id} />
            <div className="space-y-1">
              <label className="text-sm font-medium">Salary Expense Account (DR) *</label>
              <select name="salaryExpenseAccountId" required className={SELECT_CLASS}>
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Payables Account — Net Salary (CR) *</label>
              <select name="payableAccountId" required className={SELECT_CLASS}>
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Deductions Payable Account (CR)</label>
              <select name="deductionsPayableAccountId" className={SELECT_CLASS}>
                <option value="">Same as payables account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Optional — for EOBI, tax withholdings etc.</p>
            </div>
            {postState?.success === false && (
              <p className="text-sm text-destructive">{postState.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPosting}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPosting ? "Posting…" : "Confirm Post"}
              </button>
              <button
                type="button"
                onClick={() => setShowPostForm(false)}
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
              <th className="px-4 py-3 text-left font-medium">Employee</th>
              <th className="px-4 py-3 text-right font-medium">Basic</th>
              <th className="px-4 py-3 text-right font-medium">Allowances</th>
              <th className="px-4 py-3 text-right font-medium">Gross</th>
              <th className="px-4 py-3 text-right font-medium">Deductions</th>
              <th className="px-4 py-3 text-right font-medium">Tax</th>
              <th className="px-4 py-3 text-right font-medium">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {run.status === "draft"
                    ? 'Click "Generate Payslips" to compute payslips for all active employees.'
                    : "No payslips found."}
                </td>
              </tr>
            )}
            {payslips.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.employeeName}</div>
                  <div className="text-xs text-muted-foreground">{s.empCode}</div>
                </td>
                <td className="px-4 py-3 text-right">{parseFloat(s.basic).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">{parseFloat(s.allowances).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-medium">{parseFloat(s.gross).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-red-600">{parseFloat(s.deductions).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-red-600">{parseFloat(s.tax).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">{parseFloat(s.net).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          {payslips.length > 0 && (
            <tfoot className="bg-muted/30 font-semibold">
              <tr className="border-t-2">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{payslips.reduce((s, p) => s + parseFloat(p.basic), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">{payslips.reduce((s, p) => s + parseFloat(p.allowances), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">{payslips.reduce((s, p) => s + parseFloat(p.gross), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-red-600">{payslips.reduce((s, p) => s + parseFloat(p.deductions), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-red-600">{payslips.reduce((s, p) => s + parseFloat(p.tax), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-green-700">{payslips.reduce((s, p) => s + parseFloat(p.net), 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
