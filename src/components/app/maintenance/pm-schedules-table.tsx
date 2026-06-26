"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { toast } from "sonner";

import {
  createPmScheduleAction,
  updatePmScheduleAction,
  togglePmScheduleAction,
} from "@/server/actions/maintenance/pm-schedules";
import { generateDuePmWorkOrdersAction } from "@/server/actions/maintenance/work-orders";
import { SELECT_CLASS } from "@/lib/ui-constants";
import type { PmSchedule } from "@/lib/db/schema";

type AssetOption = { id: string; code: string; name: string };

function PmFormDialog({
  open,
  dialogKey,
  schedule,
  assets,
  onClose,
}: {
  open: boolean;
  dialogKey: number;
  schedule: PmSchedule | null;
  assets: AssetOption[];
  onClose: () => void;
}) {
  const action = schedule ? updatePmScheduleAction : createPmScheduleAction;
  const [state, formAction, pending] = useActionState(action, null);
  const [basis, setBasis] = useState<string>(schedule?.basis ?? "time");

  useEffect(() => {
    if (schedule) setBasis(schedule.basis);
    else setBasis("time");
  }, [schedule, open]);

  useEffect(() => {
    if (state?.success) {
      toast.success(schedule ? "Schedule updated." : "Schedule created.");
      onClose();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{schedule ? "Edit PM Schedule" : "New PM Schedule"}</h2>
        <form key={dialogKey} action={formAction} className="space-y-3">
          {schedule && <input type="hidden" name="id" value={schedule.id} />}
          <div>
            <label className="block text-sm font-medium mb-1">Asset *</label>
            <select name="assetId" defaultValue={schedule?.assetId ?? ""} required className={SELECT_CLASS}>
              <option value="">Select asset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Schedule Name *</label>
            <input name="name" defaultValue={schedule?.name ?? ""} required
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Monthly oil change" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Basis</label>
            <select name="basis" value={basis} onChange={(e) => setBasis(e.target.value)} className={SELECT_CLASS}>
              <option value="time">Time-based</option>
              <option value="meter">Meter-based</option>
            </select>
          </div>
          {basis === "time" ? (
            <div>
              <label className="block text-sm font-medium mb-1">Interval (days)</label>
              <input type="number" min="1" name="intervalDays"
                defaultValue={schedule?.intervalDays ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Interval (meter units)</label>
              <input type="number" step="0.01" min="0" name="intervalMeter"
                defaultValue={schedule?.intervalMeter ?? ""}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Next Due Date</label>
            <input type="date" name="nextDueDate" defaultValue={schedule?.nextDueDate ?? ""}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {pending ? "Saving…" : schedule ? "Save Changes" : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PmSchedulesTable({
  schedules,
  assets,
  canCreate,
  canEdit,
  canGenerateWo,
}: {
  schedules: PmSchedule[];
  assets: AssetOption[];
  canCreate: boolean;
  canEdit: boolean;
  canGenerateWo: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [editingSchedule, setEditingSchedule] = useState<PmSchedule | null>(null);
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set());
  const [generatePending, setGeneratePending] = useState(false);
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const assetMap = new Map(assets.map((a) => [a.id, `${a.code} — ${a.name}`]));

  function openNew() {
    setEditingSchedule(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(s: PmSchedule) {
    setEditingSchedule(s);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function handleToggle(id: string, isActive: boolean) {
    setTogglePending((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        const result = await togglePmScheduleAction(id, isActive);
        if (!result.success) toast.error(result.error ?? "Failed.");
      } finally {
        setTogglePending((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    });
  }

  function handleGenerateDue() {
    setGeneratePending(true);
    startTransition(async () => {
      try {
        const result = await generateDuePmWorkOrdersAction();
        if (!result.success) toast.error(result.error ?? "Failed to generate work orders.");
        else toast.success(`Generated ${result.count} work order${result.count === 1 ? "" : "s"}.`);
      } finally {
        setGeneratePending(false);
      }
    });
  }

  const dueCount = schedules.filter(
    (s) => s.isActive && s.nextDueDate && s.nextDueDate <= today
  ).length;

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          {dueCount > 0 && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-md font-medium">
              {dueCount} overdue
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {canGenerateWo && (
            <button onClick={handleGenerateDue} disabled={generatePending}
              className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted disabled:opacity-50">
              {generatePending ? "Generating…" : `Generate Due WOs${dueCount > 0 ? ` (${dueCount})` : ""}`}
            </button>
          )}
          {canCreate && (
            <button onClick={openNew}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              + New Schedule
            </button>
          )}
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Asset</th>
              <th className="px-3 py-2 text-left font-medium">Schedule</th>
              <th className="px-3 py-2 text-left font-medium">Basis</th>
              <th className="px-3 py-2 text-left font-medium">Interval</th>
              <th className="px-3 py-2 text-left font-medium">Next Due</th>
              <th className="px-3 py-2 text-left font-medium">Active</th>
              {canEdit && <th className="px-3 py-2 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">
                  No PM schedules defined.
                </td>
              </tr>
            ) : (
              schedules.map((s) => {
                const isOverdue = s.isActive && s.nextDueDate && s.nextDueDate <= today;
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs">{assetMap.get(s.assetId) ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{s.basis}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.basis === "time"
                        ? s.intervalDays ? `${s.intervalDays}d` : "—"
                        : s.intervalMeter ? `${s.intervalMeter} units` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {s.nextDueDate ? (
                        <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                          {s.nextDueDate}
                          {isOverdue ? " ⚠" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <button
                          onClick={() => handleToggle(s.id, !s.isActive)}
                          disabled={togglePending.has(s.id)}
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            s.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                          } disabled:opacity-50`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </button>
                      ) : (
                        <span className={`text-xs ${s.isActive ? "text-green-700" : "text-gray-500"}`}>
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openEdit(s)}
                          className="text-xs text-primary underline-offset-2 hover:underline">
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <PmFormDialog
        open={dialogOpen}
        dialogKey={dialogKey}
        schedule={editingSchedule}
        assets={assets}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
