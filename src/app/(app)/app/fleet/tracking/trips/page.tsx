import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { gpsTripSegments, vehicles } from "@/lib/db/schema";
import { GpsTripSegmentsTable } from "@/components/app/fleet/gps-trip-segments-table";

export default async function GpsTripSegmentsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/tracking/trips");
  }

  const permError = requirePermission("fleet:tracking:view", user);
  if (permError) redirect("/app/dashboard");

  const segments = await db
    .select({
      id: gpsTripSegments.id,
      vehicleId: gpsTripSegments.vehicleId,
      startTime: gpsTripSegments.startTime,
      endTime: gpsTripSegments.endTime,
      startLat: gpsTripSegments.startLat,
      startLng: gpsTripSegments.startLng,
      endLat: gpsTripSegments.endLat,
      endLng: gpsTripSegments.endLng,
      distanceKm: gpsTripSegments.distanceKm,
      maxSpeed: gpsTripSegments.maxSpeed,
      avgSpeed: gpsTripSegments.avgSpeed,
      tripId: gpsTripSegments.tripId,
      vehicleReg: vehicles.regNumber,
    })
    .from(gpsTripSegments)
    .innerJoin(vehicles, eq(gpsTripSegments.vehicleId, vehicles.id))
    .where(eq(gpsTripSegments.tenantId, user.tenant_id))
    .orderBy(desc(gpsTripSegments.startTime))
    .limit(200);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">GPS Trip Segments</h1>
      <p className="text-sm text-muted-foreground mt-1">Auto-detected trip segments from ignition events.</p>
      <div className="mt-6">
        <GpsTripSegmentsTable segments={segments} />
      </div>
    </div>
  );
}
