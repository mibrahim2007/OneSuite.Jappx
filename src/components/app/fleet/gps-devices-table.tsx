"use client";

import { useState, useTransition, useActionState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, PowerOff, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SELECT_CLASS } from "@/lib/ui-constants";
import { saveGpsDeviceAction, toggleGpsDeviceAction } from "@/server/actions/fleet/gps-devices";

type DeviceRow = {
  id: string;
  deviceId: string;
  vehicleId: string | null;
  provider: string | null;
  apiKey: string | null;
  isActive: boolean;
  createdAt: Date;
};

type VehicleOption = { id: string; regNumber: string };

export function GpsDevicesTable({
  devices,
  vehicles,
  canManage,
}: {
  devices: DeviceRow[];
  vehicles: VehicleOption[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceRow | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingToggle, setPendingToggle] = useState<Set<string>>(new Set());
  const [, startToggle] = useTransition();

  const [formState, formAction, isPending] = useActionState(saveGpsDeviceAction, null);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(d: DeviceRow) {
    setEditing(d);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function handleToggle(id: string, current: boolean) {
    setPendingToggle((p) => new Set(p).add(id));
    startToggle(async () => {
      try {
        const res = await toggleGpsDeviceAction(id, !current);
        if (!res.success) toast.error(res.error ?? "Failed to update.");
      } catch {
        toast.error("Unexpected error.");
      } finally {
        setPendingToggle((p) => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
      }
    });
  }

  if (formState?.success && open) setOpen(false);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Add Device
          </Button>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Cpu className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p>No GPS devices registered.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device ID</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const v = vehicles.find((x) => x.id === d.vehicleId);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.deviceId}</TableCell>
                  <TableCell>{v?.regNumber ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell>{d.provider ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.apiKey ? `${d.apiKey.slice(0, 8)}…` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={d.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {d.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingToggle.has(d.id)}
                          onClick={() => handleToggle(d.id, d.isActive)}
                        >
                          {d.isActive ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={dialogKey}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit GPS Device" : "Add GPS Device"}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <Label htmlFor="deviceId">Device ID *</Label>
              <Input id="deviceId" name="deviceId" defaultValue={editing?.deviceId ?? ""} required />
            </div>
            <div>
              <Label htmlFor="vehicleId">Vehicle</Label>
              <select id="vehicleId" name="vehicleId" className={SELECT_CLASS} defaultValue={editing?.vehicleId ?? ""}>
                <option value="">— Unassigned —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.regNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Input id="provider" name="provider" defaultValue={editing?.provider ?? ""} placeholder="e.g. Teltonika, Calamp" />
            </div>
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" name="apiKey" defaultValue={editing?.apiKey ?? ""} placeholder="Used for /api/gps/ping auth" />
            </div>
            {formState && !formState.success && (
              <p className="text-sm text-destructive">{formState.error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
