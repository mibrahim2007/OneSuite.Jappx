import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { VehiclesTable } from "@/components/app/fleet/vehicles-table";

export default async function VehiclesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/vehicles");
  }

  const permError = requirePermission("fleet:vehicle:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      id: vehicles.id,
      regNumber: vehicles.regNumber,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      type: vehicles.type,
      capacity: vehicles.capacity,
      odometer: vehicles.odometer,
      status: vehicles.status,
    })
    .from(vehicles)
    .where(eq(vehicles.tenantId, user.tenant_id))
    .orderBy(asc(vehicles.regNumber));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Vehicles</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage your fleet vehicles and their status.</p>
      <div className="mt-6">
        <VehiclesTable
          vehicles={rows}
          canCreate={user.permissions.includes("fleet:vehicle:create")}
          canEdit={user.permissions.includes("fleet:vehicle:update")}
        />
      </div>
    </div>
  );
}
