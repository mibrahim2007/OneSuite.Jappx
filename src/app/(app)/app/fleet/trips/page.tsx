import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, asc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { trips, vehicles, drivers } from "@/lib/db/schema";
import { TripsTable } from "@/components/app/fleet/trips-table";

export default async function TripsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/trips");
  }

  const permError = requirePermission("fleet:trip:view", user);
  if (permError) redirect("/app/dashboard");

  const [tripRows, vehicleOptions, driverOptions] = await Promise.all([
    db
      .select({
        id: trips.id,
        tripNo: trips.tripNo,
        vehicleId: trips.vehicleId,
        regNumber: vehicles.regNumber,
        driverName: drivers.name,
        origin: trips.origin,
        destination: trips.destination,
        startOdometer: trips.startOdometer,
        endOdometer: trips.endOdometer,
        distanceKm: trips.distanceKm,
        status: trips.status,
      })
      .from(trips)
      .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .leftJoin(drivers, eq(trips.driverId, drivers.id))
      .where(eq(trips.tenantId, user.tenant_id))
      .orderBy(desc(trips.startAt)),

    db
      .select({ id: vehicles.id, regNumber: vehicles.regNumber })
      .from(vehicles)
      .where(eq(vehicles.tenantId, user.tenant_id))
      .orderBy(asc(vehicles.regNumber)),

    db
      .select({ id: drivers.id, name: drivers.name })
      .from(drivers)
      .where(eq(drivers.tenantId, user.tenant_id))
      .orderBy(asc(drivers.name)),
  ]);

  const rows = tripRows.map((r) => ({
    ...r,
    regNumber: r.regNumber ?? "",
    driverName: r.driverName ?? null,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Trips</h1>
      <p className="text-sm text-muted-foreground mt-1">Plan and track vehicle trips.</p>
      <div className="mt-6">
        <TripsTable
          trips={rows}
          vehicles={vehicleOptions}
          drivers={driverOptions}
          canCreate={user.permissions.includes("fleet:trip:create")}
          canUpdate={user.permissions.includes("fleet:trip:update")}
        />
      </div>
    </div>
  );
}
