"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, Radio, Clock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { simulatePositionAction } from "@/server/actions/fleet/gps-devices";

type Position = {
  vehicleId: string;
  lat: string | null;
  lng: string | null;
  speedKmh: string | null;
  eventType: string;
  recordedAt: Date;
} | null;

type VehicleRow = {
  id: string;
  regNumber: string;
  make: string | null;
  model: string | null;
  status: "active" | "in_service" | "idle" | "retired";
  lastPosition: Position;
};

const EVENT_BADGE: Record<string, string> = {
  moving: "bg-green-100 text-green-800",
  idle: "bg-yellow-100 text-yellow-800",
  ignition_on: "bg-blue-100 text-blue-800",
  ignition_off: "bg-gray-100 text-gray-600",
  geofence_enter: "bg-purple-100 text-purple-800",
  geofence_exit: "bg-orange-100 text-orange-800",
};

export function TrackingView({
  vehicles,
  canSimulate,
}: {
  vehicles: VehicleRow[];
  canSimulate: boolean;
}) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleSimulate(vehicleId: string) {
    setPendingIds((prev) => new Set(prev).add(vehicleId));
    startTransition(async () => {
      try {
        const res = await simulatePositionAction(vehicleId);
        if (!res.success) toast.error(res.error ?? "Failed to simulate.");
        else toast.success("Position simulated.");
      } catch {
        toast.error("Unexpected error.");
      } finally {
        setPendingIds((prev) => {
          const n = new Set(prev);
          n.delete(vehicleId);
          return n;
        });
      }
    });
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MapPin className="mx-auto h-8 w-8 mb-2 opacity-40" />
        <p>No vehicles found. Add vehicles in the Fleet module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Radio className="h-4 w-4" />
        <span>Real-time positions — push pings via <code>POST /api/gps/ping</code> with <code>x-api-key</code> header</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead>Speed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Seen</TableHead>
            {canSimulate && <TableHead>Demo</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((v) => {
            const pos = v.lastPosition;
            return (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  {v.regNumber}
                  {v.make && <span className="text-xs text-muted-foreground ml-1">{v.make} {v.model}</span>}
                </TableCell>
                <TableCell>
                  {pos ? (
                    <span className="font-mono text-xs">
                      {parseFloat(pos.lat ?? "0").toFixed(4)}, {parseFloat(pos.lng ?? "0").toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">No data</span>
                  )}
                </TableCell>
                <TableCell>
                  {pos?.speedKmh ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Gauge className="h-3 w-3" />
                      {parseFloat(pos.speedKmh).toFixed(0)} km/h
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {pos ? (
                    <Badge className={EVENT_BADGE[pos.eventType] ?? "bg-gray-100 text-gray-700"}>
                      {pos.eventType.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500">Unknown</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {pos ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(pos.recordedAt).toLocaleString()}
                    </span>
                  ) : "—"}
                </TableCell>
                {canSimulate && (
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingIds.has(v.id)}
                      onClick={() => handleSimulate(v.id)}
                    >
                      {pendingIds.has(v.id) ? "…" : "Simulate"}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
