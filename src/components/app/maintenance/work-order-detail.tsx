"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";

import {
  updateWorkOrderAction,
  updateWorkOrderStatusAction,
  addWoTaskAction,
  toggleWoTaskAction,
  addWoPartAction,
} from "@/server/actions/maintenance/work-orders";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { WorkOrder, WoTask, WoPart } from "@/lib/db/schema";

type AssetOption = { id: string; code: string; name: string };
type ItemOption = { id: string; sku: string; name: string };
type WarehouseOption = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_hold: "bg-gray-100 text-gray-700",
  completed: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-200 text-red-900",
};

const NEXT_STATUSES: Record<string, string[]> = {
  open: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: ["closed"],
  closed: [],
  cancelled: [],
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label.replace("_", " ")}
    </span>
  );
}

export function WorkOrderDetail({
  wo,
  tasks,
  parts,
  assets,
  items,
  warehouses,
  canEdit,
  canClose,
  canConsumeParts,
}: {
  wo: WorkOrder;
  tasks: WoTask[];
  parts: WoPart[];
  assets: AssetOption[];
  items: ItemOption[];
  warehouses: WarehouseOption[];
  canEdit: boolean;
  canClose: boolean;
  canConsumeParts: boolean;
}) {
  const [tab, setTab] = useState<"details" | "tasks" | "parts">("details");
  const [editMode, setEditMode] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [taskTogglePending, setTaskTogglePending] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Update WO action
  const [updateState, updateFormAction, updatePending] = useActionState(updateWorkOrderAction, null);
  useEffect(() => {
    if (updateState?.success) { toast.success("Work order updated."); setEditMode(false); }
    else if (updateState && !updateState.success) toast.error(updateState.error);
  }, [updateState]);

  // Add task action
  const [taskState, taskFormAction, taskPending] = useActionState(addWoTaskAction, null);
  useEffect(() => {
    if (taskState?.success) toast.success("Task added.");
    else if (taskState && !taskState.success) toast.error(taskState.error);
  }, [taskState]);

  // Add part action
  const [partState, partFormAction, partPending] = useActionState(addWoPartAction, null);
  useEffect(() => {
    if (partState?.success) toast.success("Part added.");
    else if (partState && !partState.success) toast.error(partState.error);
  }, [partState]);

  function handleStatusChange(newStatus: string) {
    setStatusPending(true);
    startTransition(async () => {
      try {
        const result = await updateWorkOrderStatusAction(wo.id, newStatus);
        if (!result.success) toast.error(result.error ?? "Failed to update status.");
        else toast.success(`Status changed to ${newStatus.replace("_", " ")}.`);
      } finally {
        setStatusPending(false);
      }
    });
  }

  function handleToggleTask(taskId: string, isDone: boolean) {
    setTaskTogglePending((prev) => new Set(prev).add(taskId));
    startTransition(async () => {
      try {
        const result = await toggleWoTaskAction(taskId, isDone);
        if (!result.success) toast.error(result.error ?? "Failed.");
      } finally {
        setTaskTogglePending((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
      }
    });
  }

  const assetLabel = assets.find((a) => a.id === wo.assetId);
  const isClosed = wo.status === "closed" || wo.status === "cancelled";
  const nextStatuses = NEXT_STATUSES[wo.status] ?? [];
  const canChangeStatus = canEdit || canClose;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={"/app/rm/work-orders" as Route} className="text-sm text-muted-foreground hover:underline">
              Work Orders
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-mono">{wo.woNo}</span>
          </div>
          <h1 className="text-2xl font-semibold">{wo.title}</h1>
          {assetLabel && (
            <p className="text-sm text-muted-foreground mt-1">
              Asset: {assetLabel.code} — {assetLabel.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge label={wo.priority} colorClass={PRIORITY_COLORS[wo.priority] ?? ""} />
          <Badge label={wo.status} colorClass={STATUS_COLORS[wo.status] ?? ""} />
          {canChangeStatus && nextStatuses.length > 0 && (
            <select
              disabled={statusPending}
              onChange={(e) => { if (e.target.value) handleStatusChange(e.target.value); }}
              value=""
              className={SELECT_CLASS + " w-40"}
            >
              <option value="" disabled>Move to…</option>
              {nextStatuses.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Costs summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Labor Hours", value: wo.laborHours ?? "0" },
          { label: "Labor Cost", value: `${parseFloat(wo.laborCost ?? "0").toFixed(2)}` },
          { label: "Parts Cost", value: `${parseFloat(wo.partsCost ?? "0").toFixed(2)}` },
          { label: "Total Cost", value: `${parseFloat(wo.totalCost ?? "0").toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4 gap-4">
        {(["details", "tasks", "parts"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t}
            {t === "tasks" && ` (${tasks.length})`}
            {t === "parts" && ` (${parts.length})`}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === "details" && (
        <div>
          {editMode ? (
            <form action={updateFormAction} className="space-y-3 max-w-lg">
              <input type="hidden" name="id" value={wo.id} />
              <div>
                <label className="block text-sm font-medium mb-1">Asset</label>
                <select name="assetId" defaultValue={wo.assetId ?? ""} className={SELECT_CLASS}>
                  <option value="">No specific asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select name="type" defaultValue={wo.type} className={SELECT_CLASS}>
                    <option value="corrective">Corrective</option>
                    <option value="preventive">Preventive</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select name="priority" defaultValue={wo.priority} className={SELECT_CLASS}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input name="title" defaultValue={wo.title} required
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" defaultValue={wo.description ?? ""} rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scheduled Date</label>
                <input type="date" name="scheduledDate" defaultValue={wo.scheduledDate ?? ""}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Labor Hours</label>
                  <input type="number" step="0.01" min="0" name="laborHours"
                    defaultValue={wo.laborHours ?? "0"}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Labor Cost</label>
                  <input type="number" step="0.01" min="0" name="laborCost"
                    defaultValue={wo.laborCost ?? "0"}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={updatePending}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {updatePending ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditMode(false)}
                  className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-sm max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{wo.type}</span></div>
                <div><span className="text-muted-foreground">Priority:</span> <span className="capitalize">{wo.priority}</span></div>
                <div><span className="text-muted-foreground">Scheduled:</span> {wo.scheduledDate ?? "—"}</div>
                <div><span className="text-muted-foreground">Completed:</span> {wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : "—"}</div>
              </div>
              {wo.description && (
                <div className="mt-3 p-3 rounded-md bg-muted/30 text-sm whitespace-pre-wrap">{wo.description}</div>
              )}
              {canEdit && !isClosed && (
                <button onClick={() => setEditMode(true)}
                  className="mt-3 px-3 py-1.5 text-sm rounded-md border border-input hover:bg-muted">
                  Edit Details
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tasks tab */}
      {tab === "tasks" && (
        <div className="space-y-3">
          <div className="divide-y rounded-md border">
            {tasks.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              tasks.map((t) => (
                <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.isDone}
                    disabled={!canEdit || taskTogglePending.has(t.id)}
                    onChange={(e) => handleToggleTask(t.id, e.target.checked)}
                    className="size-4"
                  />
                  <span className={t.isDone ? "line-through text-muted-foreground" : ""}>{t.description}</span>
                </label>
              ))
            )}
          </div>
          {canEdit && !isClosed && (
            <form action={taskFormAction} className="flex gap-2">
              <input type="hidden" name="workOrderId" value={wo.id} />
              <input name="description" required placeholder="Add task…"
                className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
              <button type="submit" disabled={taskPending}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {taskPending ? "Adding…" : "Add"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Parts tab */}
      {tab === "parts" && (
        <div className="space-y-3">
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">Warehouse</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parts.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No parts consumed.</td></tr>
                ) : (
                  parts.map((p) => {
                    const item = items.find((i) => i.id === p.itemId);
                    const wh = warehouses.find((w) => w.id === p.warehouseId);
                    const qty = parseFloat(p.quantity);
                    const uc = parseFloat(p.unitCost);
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2">{item ? `${item.sku} — ${item.name}` : p.itemId}</td>
                        <td className="px-3 py-2 text-muted-foreground">{wh?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{qty.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{uc.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right">{(qty * uc).toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {canConsumeParts && !isClosed && (
            <form action={partFormAction} className="grid grid-cols-5 gap-2 items-end">
              <input type="hidden" name="workOrderId" value={wo.id} />
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Item *</label>
                <select name="itemId" required className={SELECT_CLASS}>
                  <option value="">Select item…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Warehouse</label>
                <select name="warehouseId" className={SELECT_CLASS}>
                  <option value="">None</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Qty *</label>
                <input type="number" step="0.01" min="0.01" name="quantity" required
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Unit Cost</label>
                <div className="flex gap-1">
                  <input type="number" step="0.0001" min="0" name="unitCost"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                  <button type="submit" disabled={partPending}
                    className="px-3 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
                    {partPending ? "…" : "Add"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
