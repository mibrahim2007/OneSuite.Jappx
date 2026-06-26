"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { createAppraisalCycleAction, updateCycleStatusAction, generateAppraisalsAction } from "@/server/actions/hrm/appraisals";
import type { AppraisalCycle } from "@/lib/db/schema";
import { APPRAISAL_CYCLE_STATUSES } from "@/lib/validations/hrm";

interface Props {
  cycles: AppraisalCycle[];
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  closed: "bg-blue-100 text-blue-700",
};

export default function AppraisalsView({ cycles, canManage }: Props) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [state, action, pending] = useActionState(createAppraisalCycleAction, null);
  if (state && !state.success) toast.error(state.error);
  if (state?.success && open) { setOpen(false); toast.success("Appraisal cycle created."); }

  function handleStatusChange(cycleId: string, status: "draft" | "active" | "closed") {
    startTransition(async () => {
      const res = await updateCycleStatusAction(cycleId, status);
      if (res && !res.success) toast.error(res.error);
      else toast.success("Cycle status updated.");
    });
  }

  function handleGenerate(cycleId: string) {
    startTransition(async () => {
      const res = await generateAppraisalsAction(cycleId);
      if (res && !res.success) toast.error(res.error);
      else toast.success("Appraisals generated.");
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appraisal Cycles</h1>
        {canManage && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            + New Cycle
          </button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Period", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {cycles.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">No appraisal cycles yet.</td></tr>
            )}
            {cycles.map((cycle) => (
              <tr key={cycle.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/app/hrm/appraisals/${cycle.id}` as Route} className="font-medium text-blue-600 hover:underline">
                    {cycle.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{cycle.periodStart} → {cycle.periodEnd}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cycle.status] ?? ""}`}>
                    {cycle.status}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  {canManage && cycle.status === "draft" && (
                    <>
                      <button
                        onClick={() => handleStatusChange(cycle.id, "active")}
                        disabled={isPending}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => handleGenerate(cycle.id)}
                        disabled={isPending}
                        className="text-xs px-2 py-1 bg-purple-600 text-white rounded disabled:opacity-50"
                      >
                        Generate Appraisals
                      </button>
                    </>
                  )}
                  {canManage && cycle.status === "active" && (
                    <button
                      onClick={() => handleStatusChange(cycle.id, "closed")}
                      disabled={isPending}
                      className="text-xs px-2 py-1 bg-gray-600 text-white rounded disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Appraisal Cycle</h2>
            <form key={dialogKey} action={action} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input name="name" required placeholder="e.g. Annual 2026" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input name="periodStart" type="date" required className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date *</label>
                  <input name="periodEnd" type="date" required className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select name="status" className={SELECT_CLASS}>
                  {APPRAISAL_CYCLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button disabled={pending} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {pending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
