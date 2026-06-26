"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Fuel, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { createFuelLogAction } from "@/server/actions/fleet/fuel-logs";

type FuelLogRow = {
  id: string;
  vehicleId: string;
  regNumber: string;
  tripNo: string | null;
  fuelDate: string;
  litres: string;
  cost: string;
  odometer: string | null;
  station: string | null;
};

type VehicleOption = { id: string; regNumber: string };
type TripOption = { id: string; tripNo: string };

type State = { success: true } | { success: false; error: string } | null;

function FuelLogDialog({
  open,
  onOpenChange,
  vehicles,
  trips,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: VehicleOption[];
  trips: TripOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<State, FormData>(createFuelLogAction, null);

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success("Fuel log created.");
    }
  }, [state, onOpenChange, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Fuel Log</DialogTitle>
        </DialogHeader>
        <form id="fuel-form" action={action} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="fl-vehicle">Vehicle *</Label>
              <select id="fl-vehicle" name="vehicleId" required className={SELECT_CLASS}>
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.regNumber}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="fl-trip">Trip (optional)</Label>
              <select id="fl-trip" name="tripId" className={SELECT_CLASS}>
                <option value="">No trip</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.tripNo}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fl-date">Date *</Label>
              <Input id="fl-date" name="fuelDate" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fl-station">Station</Label>
              <Input id="fl-station" name="station" placeholder="ADNOC" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fl-litres">Litres *</Label>
              <Input id="fl-litres" name="litres" required placeholder="50.0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fl-cost">Cost *</Label>
              <Input id="fl-cost" name="cost" required placeholder="250.00" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="fl-odo">Odometer (km)</Label>
              <Input id="fl-odo" name="odometer" placeholder="Optional" />
            </div>
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="fuel-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  logs: FuelLogRow[];
  vehicles: VehicleOption[];
  trips: TripOption[];
  canCreate: boolean;
};

export function FuelLogsTable({ logs, vehicles, trips, canCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  function openCreate() {
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" /> Log Fuel
          </Button>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={Fuel} title="No fuel logs" description="Record your first fuel fill-up." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Trip</TableHead>
              <TableHead>Litres</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Odometer</TableHead>
              <TableHead>Station</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.fuelDate}</TableCell>
                <TableCell className="font-mono">{l.regNumber}</TableCell>
                <TableCell>{l.tripNo ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{parseFloat(l.litres).toFixed(1)} L</TableCell>
                <TableCell>{parseFloat(l.cost).toLocaleString()}</TableCell>
                <TableCell>{l.odometer ? `${parseFloat(l.odometer).toLocaleString()} km` : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{l.station ?? <span className="text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <FuelLogDialog key={dialogKey} open={open} onOpenChange={setOpen} vehicles={vehicles} trips={trips} />
    </>
  );
}
