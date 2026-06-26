"use client";

import { Route, Clock, TrendingUp } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type TripSegmentRow = {
  id: string;
  vehicleId: string;
  vehicleReg: string;
  startTime: Date;
  endTime: Date | null;
  startLat: string | null;
  startLng: string | null;
  endLat: string | null;
  endLng: string | null;
  distanceKm: string | null;
  maxSpeed: string | null;
  avgSpeed: string | null;
  tripId: string | null;
};

function durationMinutes(start: Date, end: Date | null): string {
  if (!end) return "Open";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function GpsTripSegmentsTable({ segments }: { segments: TripSegmentRow[] }) {
  if (segments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Route className="mx-auto h-8 w-8 mb-2 opacity-40" />
        <p>No trip segments yet. Push ignition_on / ignition_off events via <code>/api/gps/ping</code>.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vehicle</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Distance</TableHead>
          <TableHead>Max Speed</TableHead>
          <TableHead>Avg Speed</TableHead>
          <TableHead>Start Coords</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {segments.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.vehicleReg}</TableCell>
            <TableCell>
              <span className="flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                {new Date(s.startTime).toLocaleString()}
              </span>
            </TableCell>
            <TableCell>{durationMinutes(s.startTime, s.endTime)}</TableCell>
            <TableCell>
              {s.distanceKm ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {parseFloat(s.distanceKm).toFixed(1)} km
                </span>
              ) : "—"}
            </TableCell>
            <TableCell>
              {s.maxSpeed ? `${parseFloat(s.maxSpeed).toFixed(0)} km/h` : "—"}
            </TableCell>
            <TableCell>
              {s.avgSpeed ? `${parseFloat(s.avgSpeed).toFixed(0)} km/h` : "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {s.startLat && s.startLng
                ? `${parseFloat(s.startLat).toFixed(4)}, ${parseFloat(s.startLng).toFixed(4)}`
                : "—"}
            </TableCell>
            <TableCell>
              {s.endTime ? (
                <Badge className="bg-gray-100 text-gray-700">Completed</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800">In Progress</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
