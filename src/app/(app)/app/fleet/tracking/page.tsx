import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, desc, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { vehicles, vehiclePositions } from "@/lib/db/schema";
import { TrackingView } from "@/components/app/fleet/tracking-view";

export default async function TrackingPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/tracking");
  }

  const permError = requirePermission("fleet:tracking:view", user);
  if (permError) redirect("/app/dashboard");

  // Last known position per vehicle using a lateral join approach
  const lastPositions = await db
    .select({
      vehicleId: vehiclePositions.vehicleId,
      lat: vehiclePositions.lat,
      lng: vehiclePositions.lng,
      speedKmh: vehiclePositions.speedKmh,
      eventType: vehiclePositions.eventType,
      recordedAt: vehiclePositions.recordedAt,
    })
    .from(vehiclePositions)
    .where(
      sql`(${vehiclePositions.vehicleId}, ${vehiclePositions.recordedAt}) IN (
        SELECT vehicle_id, MAX(recorded_at)
        FROM vehicle_positions
        WHERE tenant_id = ${user.tenant_id}::uuid
        GROUP BY vehicle_id
      )`
    );

  const posMap = new Map(lastPositions.map((p) => [p.vehicleId, p]));

  const allVehicles = await db
    .select({ id: vehicles.id, regNumber: vehicles.regNumber, make: vehicles.make, model: vehicles.model, status: vehicles.status })
    .from(vehicles)
    .where(eq(vehicles.tenantId, user.tenant_id))
    .orderBy(vehicles.regNumber);

  const rows = allVehicles.map((v) => ({
    ...v,
    lastPosition: posMap.get(v.id) ?? null,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Live Tracking</h1>
      <p className="text-sm text-muted-foreground mt-1">Last known position for each vehicle.</p>
      <div className="mt-6">
        <TrackingView
          vehicles={rows}
          canSimulate={user.permissions.includes("fleet:tracking:view")}
        />
      </div>
    </div>
  );
}
