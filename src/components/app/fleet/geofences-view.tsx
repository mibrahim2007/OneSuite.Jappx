"use client";

import { useState, useTransition, useActionState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, PowerOff, Shield, AlertTriangle } from "lucide-react";
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
import { saveGeofenceAction, toggleGeofenceAction } from "@/server/actions/fleet/gps-devices";

type Geofence = {
  id: string;
  name: string;
  type: string;
  centerLat: string | null;
  centerLng: string | null;
  radiusM: string | null;
  isActive: boolean;
  createdAt: Date;
};

type AlertRow = {
  id: string;
  geofenceId: string;
  vehicleId: string;
  vehicleReg: string;
  eventType: string;
  triggeredAt: Date;
  lat: string | null;
  lng: string | null;
};

const ALERT_BADGE: Record<string, string> = {
  enter: "bg-purple-100 text-purple-800",
  exit: "bg-orange-100 text-orange-800",
};

export function GeofencesView({
  fences,
  alerts,
  canManage,
}: {
  fences: Geofence[];
  alerts: AlertRow[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [pendingToggle, setPendingToggle] = useState<Set<string>>(new Set());
  const [, startToggle] = useTransition();

  const [formState, formAction, isPending] = useActionState(saveGeofenceAction, null);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function openEdit(f: Geofence) {
    setEditing(f);
    setDialogKey((k) => k + 1);
    setOpen(true);
  }

  function handleToggle(id: string, current: boolean) {
    setPendingToggle((p) => new Set(p).add(id));
    startToggle(async () => {
      try {
        const res = await toggleGeofenceAction(id, !current);
        if (!res.success) toast.error(res.error ?? "Failed.");
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
    <div className="space-y-8">
      {/* Geofences table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Shield className="h-5 w-5" /> Defined Geofences
          </h2>
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> Add Geofence
            </Button>
          )}
        </div>

        {fences.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No geofences defined yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Centre (lat, lng)</TableHead>
                <TableHead>Radius (m)</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fences.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="capitalize">{f.type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {f.centerLat && f.centerLng
                      ? `${parseFloat(f.centerLat).toFixed(4)}, ${parseFloat(f.centerLng).toFixed(4)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {f.radiusM ? `${parseFloat(f.radiusM).toLocaleString()} m` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={f.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {f.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(f)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingToggle.has(f.id)}
                          onClick={() => handleToggle(f.id, f.isActive)}
                        >
                          {f.isActive ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Alerts table */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" /> Recent Alerts
        </h2>
        {alerts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No geofence alerts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Triggered At</TableHead>
                <TableHead>Coordinates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.vehicleReg}</TableCell>
                  <TableCell>
                    <Badge className={ALERT_BADGE[a.eventType] ?? "bg-gray-100 text-gray-700"}>
                      {a.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.triggeredAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.lat && a.lng
                      ? `${parseFloat(a.lat).toFixed(4)}, ${parseFloat(a.lng).toFixed(4)}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={dialogKey}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Geofence" : "New Geofence"}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <Label htmlFor="gfName">Name *</Label>
              <Input id="gfName" name="name" defaultValue={editing?.name ?? ""} required />
            </div>
            <input type="hidden" name="type" value="circle" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="centerLat">Centre Latitude</Label>
                <Input id="centerLat" name="centerLat" defaultValue={editing?.centerLat ?? ""} placeholder="24.8607" />
              </div>
              <div>
                <Label htmlFor="centerLng">Centre Longitude</Label>
                <Input id="centerLng" name="centerLng" defaultValue={editing?.centerLng ?? ""} placeholder="67.0011" />
              </div>
            </div>
            <div>
              <Label htmlFor="radiusM">Radius (metres)</Label>
              <Input id="radiusM" name="radiusM" type="number" min="50" defaultValue={editing?.radiusM ?? "500"} />
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
