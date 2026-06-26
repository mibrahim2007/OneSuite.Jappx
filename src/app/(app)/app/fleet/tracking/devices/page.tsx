import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { gpsDevices, vehicles } from "@/lib/db/schema";
import { GpsDevicesTable } from "@/components/app/fleet/gps-devices-table";

export default async function GpsDevicesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/tracking/devices");
  }

  const permError = requirePermission("fleet:tracking:view", user);
  if (permError) redirect("/app/dashboard");

  const [devices, allVehicles] = await Promise.all([
    db
      .select({
        id: gpsDevices.id,
        deviceId: gpsDevices.deviceId,
        vehicleId: gpsDevices.vehicleId,
        provider: gpsDevices.provider,
        apiKey: gpsDevices.apiKey,
        isActive: gpsDevices.isActive,
        createdAt: gpsDevices.createdAt,
      })
      .from(gpsDevices)
      .where(eq(gpsDevices.tenantId, user.tenant_id))
      .orderBy(gpsDevices.createdAt),
    db
      .select({ id: vehicles.id, regNumber: vehicles.regNumber })
      .from(vehicles)
      .where(eq(vehicles.tenantId, user.tenant_id))
      .orderBy(vehicles.regNumber),
  ]);

  const canManage = user.permissions.includes("fleet:geofence:manage");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">GPS Devices</h1>
      <p className="text-sm text-muted-foreground mt-1">Register and manage telematics devices.</p>
      <div className="mt-6">
        <GpsDevicesTable devices={devices} vehicles={allVehicles} canManage={canManage} />
      </div>
    </div>
  );
}
