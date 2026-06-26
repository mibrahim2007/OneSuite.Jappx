"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";

import { createWorkOrderAction } from "@/server/actions/maintenance/work-orders";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { WorkOrder } from "@/lib/db/schema";

type WoRow = Pick<
  WorkOrder,
  | "id" | "woNo" | "assetId" | "type" | "priority" | "status" | "title"
  | "description" | "reportedBy" | "assignedTo" | "scheduledDate"
  | "laborHours" | "laborCost" | "partsCost" | "totalCost"
  | "completedAt" | "createdAt" | "updatedAt"
>;

type AssetOption = { id: string; code: string; name: string };

const TYPE_COLORS: Record<string, string> = {
  corrective: "bg-red-100 text-red-800",
  preventive: "bg-blue-100 text-blue-800",
  inspection: "bg-purple-100 text-purple-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-200 text-red-900",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_hold: "bg-gray-100 text-gray-700",
  completed: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label.replace("_", " ")}
    </span>
  );
}

function CreateWoDialog({
  open,
  dialogKey,
  assets,
  onClose,
}: {
  open: boolean;
  dialogKey: number;
  assets: AssetOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createWorkOrderAction, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Work order created.");
      onClose();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New Work Order</h2>
        <form key={dialogKey} action={formAction} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Asset</label>
            <select name="assetId" className={SELECT_CLASS}>
              <option value="">No specific asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select name="type" defaultValue="corrective" className={SELECT_CLASS}>
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select name="priority" defaultValue="medium" className={SELECT_CLASS}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input name="title" required
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Replace oil filter on Compressor A" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Optional details…" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scheduled Date</label>
            <input type="date" name="scheduledDate"
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {pending ? "Creating…" : "Create WO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WorkOrdersTable({
  workOrders: woRows,
  assets,
  canCreate,
  canEdit,
  canClose,
}: {
  workOrders: WoRow[];
  assets: AssetOption[];
  canCreate: boolean;
  canEdit: boolean;
  canClose: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const assetMap = new Map(assets.map((a) => [a.id, `${a.code} — ${a.name}`]));

  const filtered = woRows.filter((w) => {
    const matchSearch =
      w.woNo.toLowerCase().includes(search.toLowerCase()) ||
      w.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || w.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work orders…"
            className="flex h-8 w-56 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className={SELECT_CLASS + " w-36"}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {canCreate && (
          <button
            onClick={() => { setDialogKey((k) => k + 1); setDialogOpen(true); }}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            + New Work Order
          </button>
        )}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">WO No</th>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Asset</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Priority</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Scheduled</th>
              <th className="px-3 py-2 text-right font-medium">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No work orders found.
                </td>
              </tr>
            ) : (
              filtered.map((w) => (
                <tr key={w.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/app/rm/work-orders/${w.id}` as Route}
                      className="font-mono text-xs text-primary hover:underline">
                      {w.woNo}
                    </Link>
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={w.title}>{w.title}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {w.assetId ? (assetMap.get(w.assetId) ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={w.type} colorClass={TYPE_COLORS[w.type] ?? ""} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={w.priority} colorClass={PRIORITY_COLORS[w.priority] ?? ""} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={w.status} colorClass={STATUS_COLORS[w.status] ?? ""} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{w.scheduledDate ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {w.totalCost ? parseFloat(w.totalCost).toFixed(2) : "0.00"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <CreateWoDialog
        open={dialogOpen}
        dialogKey={dialogKey}
        assets={assets}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
