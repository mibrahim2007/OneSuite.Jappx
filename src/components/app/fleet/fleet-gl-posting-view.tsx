"use client";

import { useActionState, useEffect, useTransition, useState } from "react";
import { toast } from "sonner";
import { postFuelCostsAction, postWorkOrderCostAction } from "@/server/actions/costs/fleet-gl-posting";

type UnpostedWO = {
  id: string;
  woNo: string;
  title: string;
  status: string;
  totalCost: string | null;
  completedAt: Date | null;
};

export function FleetGlPostingView({ unpostedWOs }: { unpostedWOs: UnpostedWO[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [fuelState, fuelAction, fuelPending] = useActionState(postFuelCostsAction, null);
  const [pendingWOs, setPendingWOs] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!fuelState) return;
    if (fuelState.success) toast.success("Fuel costs posted to GL.");
    else toast.error(fuelState.error ?? "Failed to post fuel costs.");
  }, [fuelState]);

  function handlePostWO(woId: string) {
    startTransition(async () => {
      setPendingWOs((p) => new Set(p).add(woId));
      try {
        const result = await postWorkOrderCostAction(woId);
        if (result.success) toast.success("Work order cost posted to GL.");
        else toast.error(result.error ?? "Failed to post.");
      } catch {
        toast.error("An error occurred.");
      } finally {
        setPendingWOs((p) => {
          const n = new Set(p);
          n.delete(woId);
          return n;
        });
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Fuel Costs Batch */}
      <section>
        <h2 className="text-base font-semibold mb-3">Fleet Fuel Costs</h2>
        <form action={fuelAction} className="flex flex-wrap items-end gap-3 bg-muted/40 rounded-lg p-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">From Date</label>
            <input
              type="date"
              name="from_date"
              defaultValue={firstOfMonth}
              required
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To Date</label>
            <input
              type="date"
              name="to_date"
              defaultValue={today}
              required
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={fuelPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {fuelPending ? "Posting…" : "Post Fuel Costs to GL"}
          </button>
          <p className="text-xs text-muted-foreground w-full mt-1">
            Creates a summary journal entry for all fuel log costs in the date range.
          </p>
        </form>
      </section>

      {/* Unposted Work Orders */}
      <section>
        <h2 className="text-base font-semibold mb-3">Work Orders Pending GL Posting</h2>
        {unpostedWOs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed work orders awaiting GL posting.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">WO No.</th>
                  <th className="text-left px-4 py-2 font-medium">Title</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Total Cost</th>
                  <th className="text-left px-4 py-2 font-medium">Completed</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unpostedWOs.map((wo) => (
                  <tr key={wo.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{wo.woNo}</td>
                    <td className="px-4 py-2">{wo.title}</td>
                    <td className="px-4 py-2 capitalize">{wo.status}</td>
                    <td className="px-4 py-2 text-right">
                      {parseFloat(wo.totalCost ?? "0").toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handlePostWO(wo.id)}
                        disabled={pendingWOs.has(wo.id)}
                        className="rounded px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {pendingWOs.has(wo.id) ? "Posting…" : "Post to GL"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
