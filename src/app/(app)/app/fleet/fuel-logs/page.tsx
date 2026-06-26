import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, asc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { fuelLogs, vehicles, trips } from "@/lib/db/schema";
import { FuelLogsTable } from "@/components/app/fleet/fuel-logs-table";

export default async function FuelLogsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/fuel-logs");
  }

  const permError = requirePermission("fleet:fuel:view", user);
  if (permError) redirect("/app/dashboard");

  const [logRows, vehicleOptions, tripOptions] = await Promise.all([
    db
      .select({
        id: fuelLogs.id,
        vehicleId: fuelLogs.vehicleId,
        regNumber: vehicles.regNumber,
        tripNo: trips.tripNo,
        fuelDate: fuelLogs.fuelDate,
        litres: fuelLogs.litres,
        cost: fuelLogs.cost,
        odometer: fuelLogs.odometer,
        station: fuelLogs.station,
      })
      .from(fuelLogs)
      .leftJoin(vehicles, eq(fuelLogs.vehicleId, vehicles.id))
      .leftJoin(trips, eq(fuelLogs.tripId, trips.id))
      .where(eq(fuelLogs.tenantId, user.tenant_id))
      .orderBy(desc(fuelLogs.fuelDate)),

    db
      .select({ id: vehicles.id, regNumber: vehicles.regNumber })
      .from(vehicles)
      .where(eq(vehicles.tenantId, user.tenant_id))
      .orderBy(asc(vehicles.regNumber)),

    db
      .select({ id: trips.id, tripNo: trips.tripNo })
      .from(trips)
      .where(eq(trips.tenantId, user.tenant_id))
      .orderBy(desc(trips.startAt)),
  ]);

  const rows = logRows.map((r) => ({
    ...r,
    regNumber: r.regNumber ?? "",
    tripNo: r.tripNo ?? null,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Fuel Logs</h1>
      <p className="text-sm text-muted-foreground mt-1">Track fuel consumption across your fleet.</p>
      <div className="mt-6">
        <FuelLogsTable
          logs={rows}
          vehicles={vehicleOptions}
          trips={tripOptions}
          canCreate={user.permissions.includes("fleet:fuel:create")}
        />
      </div>
    </div>
  );
}
