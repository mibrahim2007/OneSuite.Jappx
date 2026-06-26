"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, Plus, Pencil } from "lucide-react";

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
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from "@/lib/validations/fleet";
import {
  createVehicleAction,
  updateVehicleAction,
  updateVehicleStatusAction,
} from "@/server/actions/fleet/vehicles";

type Vehicle = {
  id: string;
  regNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  type: string | null;
  capacity: string | null;
  odometer: string | null;
  status: "active" | "in_service" | "idle" | "retired";
};

type State = { success: true } | { success: false; error: string } | null;

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  in_service: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  idle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  retired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function VehicleDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Vehicle | null;
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<State, FormData>(createVehicleAction, null);
  const [updateState, updateAction, updatePending] = useActionState<State, FormData>(updateVehicleAction, null);
  const state = editing ? updateState : createState;
  const action = editing ? updateAction : createAction;
  const pending = editing ? updatePending : createPending;

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
      toast.success(editing ? "Vehicle updated." : "Vehicle created.");
    }
  }, [state, editing, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Vehicle" : "New Vehicle"}</DialogTitle>
        </DialogHeader>
        <form id="vehicle-form" action={action} className="space-y-4 pt-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="veh-reg">Registration Number *</Label>
              <Input id="veh-reg" name="regNumber" required defaultValue={editing?.regNumber ?? ""} placeholder="ABC-123" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-make">Make</Label>
              <Input id="veh-make" name="make" defaultValue={editing?.make ?? ""} placeholder="Toyota" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-model">Model</Label>
              <Input id="veh-model" name="model" defaultValue={editing?.model ?? ""} placeholder="Hilux" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-year">Year</Label>
              <Input id="veh-year" name="year" defaultValue={editing?.year ? String(editing.year) : ""} placeholder="2023" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-type">Type</Label>
              <Input id="veh-type" name="type" defaultValue={editing?.type ?? ""} placeholder="Pickup" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-capacity">Capacity</Label>
              <Input id="veh-capacity" name="capacity" defaultValue={editing?.capacity ?? ""} placeholder="1 ton" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-odometer">Odometer (km)</Label>
              <Input id="veh-odometer" name="odometer" defaultValue={editing?.odometer ?? "0"} placeholder="0" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="veh-status">Status</Label>
              <select id="veh-status" name="status" defaultValue={editing?.status ?? "active"} className={SELECT_CLASS}>
                {VEHICLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          {state && !state.success && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="vehicle-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  vehicles: Vehicle[];
  canCreate: boolean;
  canEdit: boolean;
};

export function VehiclesTable({ vehicles, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function handleStatusChange(id: string, status: typeof VEHICLE_STATUSES[number]) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const res = await updateVehicleStatusAction(id, status);
      setPendingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      if (res.success) { router.refresh(); toast.success("Status updated."); }
      else toast.error(res.error ?? "Failed.");
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" /> New Vehicle
          </Button>
        )}
      </div>

      {vehicles.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles" description="Register your first vehicle." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg #</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Odometer</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono font-medium">{v.regNumber}</TableCell>
                <TableCell>
                  {[v.make, v.model].filter(Boolean).join(" ") || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{v.year ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{v.type ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{v.odometer ? `${parseFloat(v.odometer).toLocaleString()} km` : "—"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <select
                      value={v.status}
                      disabled={pendingIds.has(v.id)}
                      onChange={(e) => handleStatusChange(v.id, e.target.value as typeof VEHICLE_STATUSES[number])}
                      className="text-xs rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {VEHICLE_STATUSES.map((s) => (
                        <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge className={STATUS_BADGE[v.status] ?? ""}>{VEHICLE_STATUS_LABELS[v.status]}</Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <VehicleDialog key={dialogKey} open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}
