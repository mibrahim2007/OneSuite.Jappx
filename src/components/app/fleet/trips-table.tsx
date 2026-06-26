"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Route, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { TRIP_STATUSES, TRIP_STATUS_LABELS } from "@/lib/validations/fleet";
import { createTripAction, updateTripStatusAction } from "@/server/actions/fleet/trips";

type TripRow = {
  id: string;
  tripNo: string;
  vehicleId: string;
  regNumber: string;
  driverName: string | null;
  origin: string | null;
  destination: string | null;
  startOdometer: string | null;
  endOdometer: string | null;
  distanceKm: string | null;
  status: "planned" | "dispatched" | "in_progress" | "completed" | "cancelled";
};

type VehicleOption = { id: string; regNumber: string };
type DriverOption = { id: string; name: string };

type State = { success: true } | { success: false; error: string } | null;

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  dispatched: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const ALLOWED_TRANSITIONS: Record<string, typeof TRIP_STATUSES[number][]> = {
  planned: ["dispatched", "cancelled"],
  dispatched: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function TripDialog({
  open,
  onOpenChange,
  vehicles,
  drivers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: VehicleOption[];
  drivers: DriverOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<State, FormData>(createTripAction, null);

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success("Trip created.");
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Trip</DialogTitle>
        </DialogHeader>
        <form id="trip-form" action={action} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="trp-vehicle">Vehicle *</Label>
              <select id="trp-vehicle" name="vehicleId" required className={SELECT_CLASS}>
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.regNumber}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="trp-driver">Driver</Label>
              <select id="trp-driver" name="driverId" className={SELECT_CLASS}>
                <option value="">No driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trp-origin">Origin</Label>
              <Input id="trp-origin" name="origin" placeholder="Dubai" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trp-dest">Destination</Label>
              <Input id="trp-dest" name="destination" placeholder="Abu Dhabi" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trp-start-odo">Start Odometer</Label>
              <Input id="trp-start-odo" name="startOdometer" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trp-end-odo">End Odometer</Label>
              <Input id="trp-end-odo" name="endOdometer" placeholder="0" />
            </div>
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="trip-form" disabled={pending}>
            {pending ? "Creating…" : "Create Trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  trips: TripRow[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  canCreate: boolean;
  canUpdate: boolean;
};

export function TripsTable({ trips, vehicles, drivers, canCreate, canUpdate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function openCreate() {
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function handleStatusChange(id: string, status: typeof TRIP_STATUSES[number]) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const res = await updateTripStatusAction(id, status);
      setPendingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      if (res.success) { router.refresh(); toast.success("Trip status updated."); }
      else toast.error(res.error ?? "Failed.");
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" /> New Trip
          </Button>
        )}
      </div>

      {trips.length === 0 ? (
        <EmptyState icon={Route} title="No trips" description="Create your first trip." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip #</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((t) => {
              const nextStatuses = ALLOWED_TRANSITIONS[t.status] ?? [];
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm font-medium">{t.tripNo}</TableCell>
                  <TableCell>{t.regNumber}</TableCell>
                  <TableCell>{t.driverName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {t.origin || t.destination ? (
                      <span className="text-sm">{t.origin ?? "?"} → {t.destination ?? "?"}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.distanceKm ? `${parseFloat(t.distanceKm).toFixed(1)} km` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {canUpdate && nextStatuses.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_BADGE[t.status] ?? ""}>{TRIP_STATUS_LABELS[t.status]}</Badge>
                        <select
                          disabled={pendingIds.has(t.id)}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleStatusChange(t.id, e.target.value as typeof TRIP_STATUSES[number]);
                            e.target.value = "";
                          }}
                          className="text-xs rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <option value="">Move to…</option>
                          {nextStatuses.map((s) => (
                            <option key={s} value={s}>{TRIP_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <Badge className={STATUS_BADGE[t.status] ?? ""}>{TRIP_STATUS_LABELS[t.status]}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <TripDialog key={dialogKey} open={open} onOpenChange={setOpen} vehicles={vehicles} drivers={drivers} />
    </>
  );
}
