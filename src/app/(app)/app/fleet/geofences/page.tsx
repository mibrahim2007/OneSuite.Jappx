import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { geofences, geofenceAlerts, vehicles } from "@/lib/db/schema";
import { GeofencesView } from "@/components/app/fleet/geofences-view";

export default async function GeofencesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/geofences");
  }

  const permError = requirePermission("fleet:tracking:view", user);
  if (permError) redirect("/app/dashboard");

  const [fences, alerts] = await Promise.all([
    db
      .select()
      .from(geofences)
      .where(eq(geofences.tenantId, user.tenant_id))
      .orderBy(geofences.name),
    db
      .select({
        id: geofenceAlerts.id,
        geofenceId: geofenceAlerts.geofenceId,
        vehicleId: geofenceAlerts.vehicleId,
        eventType: geofenceAlerts.eventType,
        triggeredAt: geofenceAlerts.triggeredAt,
        lat: geofenceAlerts.lat,
        lng: geofenceAlerts.lng,
        vehicleReg: vehicles.regNumber,
      })
      .from(geofenceAlerts)
      .innerJoin(vehicles, eq(geofenceAlerts.vehicleId, vehicles.id))
      .where(eq(geofenceAlerts.tenantId, user.tenant_id))
      .orderBy(desc(geofenceAlerts.triggeredAt))
      .limit(50),
  ]);

  const canManage = user.permissions.includes("fleet:geofence:manage");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Geofences</h1>
      <p className="text-sm text-muted-foreground mt-1">Define virtual boundaries and view crossing alerts.</p>
      <div className="mt-6">
        <GeofencesView fences={fences} alerts={alerts} canManage={canManage} />
      </div>
    </div>
  );
}
