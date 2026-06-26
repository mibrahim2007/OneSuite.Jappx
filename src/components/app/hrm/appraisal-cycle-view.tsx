"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveKpisAction, submitManagerReviewAction } from "@/server/actions/hrm/appraisals";
import type { AppraisalCycle, Appraisal, AppraisalKpi } from "@/lib/db/schema";

interface Props {
  cycle: AppraisalCycle;
  appraisals: Appraisal[];
  kpis: AppraisalKpi[];
  employees: { id: string; fullName: string; empCode: string }[];
  currentUserId: string;
  canManage: boolean;
  canSelf: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  self_review: "bg-blue-100 text-blue-700",
  manager_review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
};

interface KpiRow { kpiName: string; target: string; actual: string; weight: string; rating: string; comments: string; }

function KpiForm({ appraisalId, existingKpis }: { appraisalId: string; existingKpis: AppraisalKpi[] }) {
  const [rows, setRows] = useState<KpiRow[]>(
    existingKpis.length > 0
      ? existingKpis.map((k) => ({
          kpiName: k.kpiName,
          target: k.target ?? "",
          actual: k.actual ?? "",
          weight: k.weight ?? "",
          rating: k.rating ?? "",
          comments: k.comments ?? "",
        }))
      : [{ kpiName: "", target: "", actual: "", weight: "", rating: "", comments: "" }]
  );
  const [isPending, startTransition] = useTransition();

  function addRow() { setRows((r) => [...r, { kpiName: "", target: "", actual: "", weight: "", rating: "", comments: "" }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function update(i: number, field: keyof KpiRow, val: string) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("appraisalId", appraisalId);
      fd.set("kpis", JSON.stringify(rows));
      const res = await saveKpisAction(null, fd);
      if (res && !res.success) toast.error(res.error);
      else toast.success("KPIs saved.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["KPI", "Target", "Actual", "Weight %", "Rating (1-5)", "Comments", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-2 py-1"><input value={row.kpiName} onChange={(e) => update(i, "kpiName", e.target.value)} className="border rounded px-2 py-1 text-sm w-36" placeholder="KPI name" /></td>
                <td className="px-2 py-1"><input value={row.target} onChange={(e) => update(i, "target", e.target.value)} className="border rounded px-2 py-1 text-sm w-24" /></td>
                <td className="px-2 py-1"><input value={row.actual} onChange={(e) => update(i, "actual", e.target.value)} className="border rounded px-2 py-1 text-sm w-24" /></td>
                <td className="px-2 py-1"><input value={row.weight} onChange={(e) => update(i, "weight", e.target.value)} type="number" min="0" max="100" className="border rounded px-2 py-1 text-sm w-16" /></td>
                <td className="px-2 py-1"><input value={row.rating} onChange={(e) => update(i, "rating", e.target.value)} type="number" min="1" max="5" className="border rounded px-2 py-1 text-sm w-16" /></td>
                <td className="px-2 py-1"><input value={row.comments} onChange={(e) => update(i, "comments", e.target.value)} className="border rounded px-2 py-1 text-sm w-36" /></td>
                <td className="px-2 py-1"><button onClick={() => removeRow(i)} className="text-red-500 text-xs">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button onClick={addRow} className="text-sm text-blue-600 hover:underline">+ Add KPI</button>
        <button onClick={handleSave} disabled={isPending} className="px-3 py-1 bg-blue-600 text-white text-sm rounded disabled:opacity-50">
          {isPending ? "Saving…" : "Save Self-Review"}
        </button>
      </div>
    </div>
  );
}

function ManagerReviewPanel({ appraisalId }: { appraisalId: string }) {
  const [rating, setRating] = useState("");
  const [comments, setComments] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitManagerReviewAction(appraisalId, rating, comments);
      if (res && !res.success) toast.error(res.error);
      else toast.success("Review submitted.");
    });
  }

  return (
    <div className="space-y-2 border-t pt-3 mt-3">
      <h4 className="text-sm font-medium">Manager Review</h4>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Overall Rating (1–5)</label>
          <input value={rating} onChange={(e) => setRating(e.target.value)} type="number" min="1" max="5" step="0.1" className="border rounded px-2 py-1 text-sm w-20" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Comments</label>
          <input value={comments} onChange={(e) => setComments(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
        </div>
        <button onClick={handleSubmit} disabled={isPending || !rating} className="px-3 py-1 bg-green-600 text-white text-sm rounded disabled:opacity-50">
          {isPending ? "…" : "Complete"}
        </button>
      </div>
    </div>
  );
}

export default function AppraisalCycleView({ cycle, appraisals, kpis, employees, currentUserId, canManage, canSelf }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const empName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? id;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{cycle.name}</h1>
            <p className="text-sm text-gray-500">{cycle.periodStart} → {cycle.periodEnd}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${cycle.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {cycle.status}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {appraisals.length === 0 && (
          <div className="text-center py-10 text-gray-500 border rounded-lg">
            No appraisals yet. Use &quot;Generate Appraisals&quot; from the cycles list to create them.
          </div>
        )}
        {appraisals.map((apr) => {
          const myKpis = kpis.filter((k) => k.appraisalId === apr.id);
          const isExpanded = expandedId === apr.id;
          const isMine = apr.employeeId === currentUserId;

          return (
            <div key={apr.id} className="border rounded-lg bg-white overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : apr.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{empName(apr.employeeId)}</span>
                  {apr.reviewerId && (
                    <span className="text-xs text-gray-500">Reviewer: {empName(apr.reviewerId)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {apr.overallRating && (
                    <span className="text-sm font-medium">{apr.overallRating}/5</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[apr.status] ?? ""}`}>
                    {apr.status.replace("_", " ")}
                  </span>
                  <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t">
                  <div className="mt-3">
                    <h4 className="text-sm font-medium mb-2">KPIs</h4>
                    {myKpis.length === 0 && apr.status === "pending" && (canSelf && isMine || canManage) ? (
                      <KpiForm appraisalId={apr.id} existingKpis={myKpis} />
                    ) : myKpis.length > 0 ? (
                      <div className="space-y-2">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              {["KPI", "Target", "Actual", "Weight", "Rating", "Comments"].map((h) => (
                                <th key={h} className="px-2 py-1 text-left font-medium text-gray-600">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {myKpis.map((k) => (
                              <tr key={k.id}>
                                <td className="px-2 py-1 font-medium">{k.kpiName}</td>
                                <td className="px-2 py-1">{k.target ?? "—"}</td>
                                <td className="px-2 py-1">{k.actual ?? "—"}</td>
                                <td className="px-2 py-1">{k.weight ?? "—"}%</td>
                                <td className="px-2 py-1">{k.rating ?? "—"}/5</td>
                                <td className="px-2 py-1">{k.comments ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(canSelf && isMine) && apr.status === "self_review" && (
                          <KpiForm appraisalId={apr.id} existingKpis={myKpis} />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No KPIs yet.</p>
                    )}

                    {canManage && apr.status === "self_review" && (
                      <ManagerReviewPanel appraisalId={apr.id} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
