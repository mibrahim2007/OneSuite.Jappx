"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Wrench, CalendarClock, AlertTriangle, CheckCircle, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Vehicle, WorkOrder, VehicleServiceSchedule } from "@/lib/db/schema";
import { generateServiceWoAction, completeServiceScheduleAction } from "@/server/actions/fleet/vehicle-service";

type WoRow = Pick<WorkOrder, "id" | "woNo" | "type" | "priority" | "status" | "title" | "scheduledDate" | "completedAt" | "totalCost" | "createdAt">;
type SchedRow = VehicleServiceSchedule;

type Props = {
  vehicle: Vehicle;
  workOrders: WoRow[];
  schedules: SchedRow[];
  canEdit: boolean;
  canCreateWo: boolean;
};

const WO_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  on_hold: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

function isOverdue(sched: SchedRow, odometer: string | null): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (sched.nextDueDate && sched.nextDueDate < today) return true;
  if (sched.nextDueKm && odometer && parseFloat(odometer) >= parseFloat(sched.nextDueKm)) return true;
  return false;
}

export function VehicleDetailView({ vehicle, workOrders, schedules, canEdit, canCreateWo }: Props) {
  const [tab, setTab] = useState<"wo" | "schedules">("wo");
  const [pendingWo, setPendingWo] = useState<Set<string>>(new Set());
  const [pendingComplete, setPendingComplete] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleGenerateWo(scheduleId?: string) {
    const key = scheduleId ?? "__vehicle__";
    setPendingWo((prev) => new Set(prev).add(key));
    startTransition(async () => {
      try {
        const res = await generateServiceWoAction(vehicle.id, scheduleId);
        if (res?.success) {
          toast.success("Service work order created.");
        } else {
          toast.error(res?.error ?? "Failed to create work order.");
        }
      } catch {
        toast.error("Failed to create work order.");
      } finally {
        setPendingWo((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        });
      }
    });
  }

  function handleCompleteSchedule(scheduleId: string) {
    const today = new Date().toISOString().slice(0, 10);
    setPendingComplete((prev) => new Set(prev).add(scheduleId));
    startTransition(async () => {
      try {
        const res = await completeServiceScheduleAction(scheduleId, today, vehicle.odometer);
        if (res?.success) {
          toast.success("Service schedule updated.");
        } else {
          toast.error(res?.error ?? "Failed to update schedule.");
        }
      } catch {
        toast.error("Failed to update schedule.");
      } finally {
        setPendingComplete((prev) => {
          const n = new Set(prev);
          n.delete(scheduleId);
          return n;
        });
      }
    });
  }

  return (
    <div>
      {/* Vehicle info cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="font-medium capitalize mt-1">{vehicle.status.replace(/_/g, " ")}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Odometer</p>
          <p className="font-medium mt-1">{vehicle.odometer ?? "—"} km</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-medium mt-1">{vehicle.type ?? "—"}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Capacity</p>
          <p className="font-medium mt-1">{vehicle.capacity ?? "—"}</p>
        </div>
      </div>

      {!vehicle.assetId && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          This vehicle is not linked to an asset. Work orders created here will not reference an asset.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-4">
        <button
          onClick={() => setTab("wo")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "wo" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-1.5"><Wrench className="size-3.5" /> Work Orders ({workOrders.length})</span>
        </button>
        <button
          onClick={() => setTab("schedules")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "schedules" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" /> Service Schedules ({schedules.length})</span>
        </button>
      </div>

      {/* Work Orders tab */}
      {tab === "wo" && (
        <div>
          {canCreateWo && (
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => handleGenerateWo(undefined)}
                disabled={pendingWo.has("__vehicle__")}
              >
                <Plus className="size-3.5 mr-1" />
                {pendingWo.has("__vehicle__") ? "Creating…" : "Create Service WO"}
              </Button>
            </div>
          )}
          {workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No work orders for this vehicle yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO No.</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell className="font-mono text-xs">{wo.woNo}</TableCell>
                    <TableCell className="max-w-48 truncate">{wo.title}</TableCell>
                    <TableCell className="capitalize">{wo.type}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[wo.priority] ?? ""}`}>
                        {wo.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${WO_STATUS_COLORS[wo.status] ?? ""}`}>
                        {wo.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{wo.scheduledDate ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">
                      {wo.totalCost ? parseFloat(wo.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Service Schedules tab */}
      {tab === "schedules" && (
        <div>
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No service schedules defined for this vehicle.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Last Service</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((sched) => {
                  const overdue = isOverdue(sched, vehicle.odometer);
                  return (
                    <TableRow key={sched.id}>
                      <TableCell className="font-medium">{sched.serviceType}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sched.intervalDays ? `${sched.intervalDays}d` : ""}
                        {sched.intervalDays && sched.intervalKm ? " / " : ""}
                        {sched.intervalKm ? `${sched.intervalKm}km` : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sched.lastServiceDate ?? "—"}
                        {sched.lastServiceKm ? ` (${sched.lastServiceKm}km)` : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sched.nextDueDate ?? "—"}
                        {sched.nextDueKm ? ` / ${sched.nextDueKm}km` : ""}
                      </TableCell>
                      <TableCell>
                        {overdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            <AlertTriangle className="size-3" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            <CheckCircle className="size-3" /> OK
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          {canCreateWo && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGenerateWo(sched.id)}
                              disabled={pendingWo.has(sched.id)}
                            >
                              {pendingWo.has(sched.id) ? "…" : "Generate WO"}
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteSchedule(sched.id)}
                              disabled={pendingComplete.has(sched.id)}
                            >
                              {pendingComplete.has(sched.id) ? "…" : "Mark Done"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
