"use client";

import Link from "next/link";
import { AlertTriangle, Wrench, CheckCircle, Fuel, ExternalLink } from "lucide-react";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type OpenWo = {
  id: string;
  woNo: string;
  title: string;
  status: string;
  priority: string;
  assetId: string | null;
  createdAt: Date;
};

type OverdueSchedule = {
  id: string;
  vehicleId: string;
  serviceType: string;
  nextDueDate: string | null;
  nextDueKm: string | null;
};

type CompletedWo = {
  id: string;
  woNo: string;
  title: string;
  assetId: string | null;
  completedAt: Date | null;
  totalCost: string | null;
};

type FuelStat = {
  vehicleId: string;
  totalLitres: string;
  totalCost: string;
  fillCount: string;
};

type VehicleInfo = { id: string; regNumber: string; assetId: string | null; odometer: string | null };

type Props = {
  openWos: OpenWo[];
  overdueSchedules: OverdueSchedule[];
  recentCompleted: CompletedWo[];
  fuelStats: FuelStat[];
  vehicleMap: Record<string, VehicleInfo>;
  assetToVehicle: Record<string, VehicleInfo>;
  canCreateWo: boolean;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const WO_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  on_hold: "bg-orange-100 text-orange-800",
};

export function FleetMaintenanceDashboard({
  openWos,
  overdueSchedules,
  recentCompleted,
  fuelStats,
  vehicleMap,
  assetToVehicle,
  canCreateWo: _canCreateWo,
}: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Open Work Orders */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Wrench className="size-4 text-amber-600" />
          <h2 className="font-semibold text-sm">Open Work Orders ({openWos.length})</h2>
        </div>
        {openWos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No open work orders for vehicles.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openWos.map((wo) => {
                const vehicle = wo.assetId ? assetToVehicle[wo.assetId] : null;
                return (
                  <TableRow key={wo.id}>
                    <TableCell className="font-medium text-sm">
                      {vehicle ? (
                        <Link href={`/app/fleet/vehicles/${vehicle.id}` as never} className="hover:underline flex items-center gap-1">
                          {vehicle.regNumber} <ExternalLink className="size-3 text-muted-foreground" />
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/app/rm/work-orders` as never} className="font-mono text-xs hover:underline">{wo.woNo}</Link>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[wo.priority] ?? ""}`}>
                        {wo.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${WO_STATUS_COLORS[wo.status] ?? ""}`}>
                        {wo.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Overdue Service Schedules */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <AlertTriangle className="size-4 text-red-600" />
          <h2 className="font-semibold text-sm">Overdue Service Schedules ({overdueSchedules.length})</h2>
        </div>
        {overdueSchedules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">All vehicles are up to date.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Due KM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueSchedules.map((sched) => {
                const vehicle = vehicleMap[sched.vehicleId];
                return (
                  <TableRow key={sched.id}>
                    <TableCell className="font-medium text-sm">
                      {vehicle ? (
                        <Link href={`/app/fleet/vehicles/${vehicle.id}` as never} className="hover:underline flex items-center gap-1">
                          {vehicle.regNumber} <ExternalLink className="size-3 text-muted-foreground" />
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{sched.serviceType}</TableCell>
                    <TableCell className="text-red-700 font-medium text-sm">{sched.nextDueDate ?? "—"}</TableCell>
                    <TableCell className="text-sm">{sched.nextDueKm ? `${sched.nextDueKm} km` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Recent Completed WOs */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <CheckCircle className="size-4 text-green-600" />
          <h2 className="font-semibold text-sm">Recent Completions</h2>
        </div>
        {recentCompleted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No completed work orders yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>WO</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCompleted.map((wo) => {
                const vehicle = wo.assetId ? assetToVehicle[wo.assetId] : null;
                return (
                  <TableRow key={wo.id}>
                    <TableCell className="text-sm font-medium">
                      {vehicle ? (
                        <Link href={`/app/fleet/vehicles/${vehicle.id}` as never} className="hover:underline">{vehicle.regNumber}</Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{wo.woNo}</TableCell>
                    <TableCell className="text-sm">
                      {wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {wo.totalCost ? parseFloat(wo.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Fuel Efficiency */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Fuel className="size-4 text-blue-600" />
          <h2 className="font-semibold text-sm">Fuel Usage — Last 30 Days</h2>
        </div>
        {fuelStats.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No fuel logs in the last 30 days.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Fill-ups</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fuelStats.map((stat) => {
                const vehicle = vehicleMap[stat.vehicleId];
                return (
                  <TableRow key={stat.vehicleId}>
                    <TableCell className="text-sm font-medium">
                      {vehicle ? (
                        <Link href={`/app/fleet/vehicles/${vehicle.id}` as never} className="hover:underline">{vehicle.regNumber}</Link>
                      ) : stat.vehicleId}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {parseFloat(stat.totalLitres).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {parseFloat(stat.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-sm">{stat.fillCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
