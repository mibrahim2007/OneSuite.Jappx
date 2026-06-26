import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { vehicles, vehicleServiceSchedules, workOrders, fuelLogs } from "@/lib/db/schema";
import { FleetMaintenanceDashboard } from "@/components/app/fleet/fleet-maintenance-dashboard";

export default async function FleetMaintenancePage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/maintenance");
  }

  const permError = requirePermission("fleet:vehicle:view", user);
  if (permError) redirect("/app/dashboard");

  const tenantId = user.tenant_id;
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Fetch all active vehicles
  const allVehicles = await db
    .select({ id: vehicles.id, regNumber: vehicles.regNumber, assetId: vehicles.assetId, odometer: vehicles.odometer })
    .from(vehicles)
    .where(eq(vehicles.tenantId, tenantId));

  // Vehicles with linked assets
  const vehiclesWithAsset = allVehicles.filter((v) => v.assetId);
  const assetIds = vehiclesWithAsset.map((v) => v.assetId!);

  // Open WOs for vehicles (via assetId)
  const openWos = assetIds.length > 0
    ? await db
        .select({
          id: workOrders.id,
          woNo: workOrders.woNo,
          title: workOrders.title,
          status: workOrders.status,
          priority: workOrders.priority,
          assetId: workOrders.assetId,
          createdAt: workOrders.createdAt,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, tenantId),
            inArray(workOrders.status, ["open", "assigned", "in_progress", "on_hold"]),
            isNotNull(workOrders.assetId),
            inArray(workOrders.assetId, assetIds)
          )
        )
        .orderBy(workOrders.createdAt)
    : [];

  // Overdue service schedules
  const overdueSchedules = await db
    .select({
      id: vehicleServiceSchedules.id,
      vehicleId: vehicleServiceSchedules.vehicleId,
      serviceType: vehicleServiceSchedules.serviceType,
      nextDueDate: vehicleServiceSchedules.nextDueDate,
      nextDueKm: vehicleServiceSchedules.nextDueKm,
    })
    .from(vehicleServiceSchedules)
    .where(
      and(
        eq(vehicleServiceSchedules.tenantId, tenantId),
        lt(vehicleServiceSchedules.nextDueDate, today)
      )
    );

  // Also check km-overdue (next_due_km <= vehicle odometer)
  const kmOverdue = await db
    .select({
      id: vehicleServiceSchedules.id,
      vehicleId: vehicleServiceSchedules.vehicleId,
      serviceType: vehicleServiceSchedules.serviceType,
      nextDueDate: vehicleServiceSchedules.nextDueDate,
      nextDueKm: vehicleServiceSchedules.nextDueKm,
    })
    .from(vehicleServiceSchedules)
    .innerJoin(vehicles, eq(vehicleServiceSchedules.vehicleId, vehicles.id))
    .where(
      and(
        eq(vehicleServiceSchedules.tenantId, tenantId),
        isNotNull(vehicleServiceSchedules.nextDueKm),
        lte(vehicleServiceSchedules.nextDueKm, vehicles.odometer)
      )
    );

  // Merge and deduplicate overdue schedules
  const overdueIds = new Set(overdueSchedules.map((s) => s.id));
  const allOverdue = [...overdueSchedules, ...kmOverdue.filter((s) => !overdueIds.has(s.id))];

  // Recent completed WOs for vehicles (last 10)
  const recentCompleted = assetIds.length > 0
    ? await db
        .select({
          id: workOrders.id,
          woNo: workOrders.woNo,
          title: workOrders.title,
          assetId: workOrders.assetId,
          completedAt: workOrders.completedAt,
          totalCost: workOrders.totalCost,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, tenantId),
            eq(workOrders.status, "completed"),
            isNotNull(workOrders.assetId),
            inArray(workOrders.assetId, assetIds)
          )
        )
        .orderBy(sql`${workOrders.completedAt} DESC NULLS LAST`)
        .limit(10)
    : [];

  // Fuel efficiency: avg km/litre per vehicle last 30 days
  const fuelStats = await db
    .select({
      vehicleId: fuelLogs.vehicleId,
      totalLitres: sql<string>`SUM(${fuelLogs.litres})`,
      totalCost: sql<string>`SUM(${fuelLogs.cost})`,
      fillCount: sql<string>`COUNT(*)`,
    })
    .from(fuelLogs)
    .where(and(eq(fuelLogs.tenantId, tenantId), gte(fuelLogs.fuelDate, thirtyDaysAgo)))
    .groupBy(fuelLogs.vehicleId);

  // Build vehicle lookup map
  const vehicleMap = Object.fromEntries(
    allVehicles.map((v) => [v.id, v])
  );
  const assetToVehicle = Object.fromEntries(
    vehiclesWithAsset.map((v) => [v.assetId!, v])
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Fleet Maintenance</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Cross-module overview of vehicle service status and work orders.
      </p>
      <div className="mt-6">
        <FleetMaintenanceDashboard
          openWos={openWos}
          overdueSchedules={allOverdue}
          recentCompleted={recentCompleted}
          fuelStats={fuelStats}
          vehicleMap={vehicleMap}
          assetToVehicle={assetToVehicle}
          canCreateWo={user.permissions.includes("rm:workorder:create")}
        />
      </div>
    </div>
  );
}
