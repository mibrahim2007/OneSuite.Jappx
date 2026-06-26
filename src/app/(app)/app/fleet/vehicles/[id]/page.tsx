import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { vehicles, vehicleServiceSchedules, workOrders, assets } from "@/lib/db/schema";
import { VehicleDetailView } from "@/components/app/fleet/vehicle-detail-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/app/fleet/vehicles/${id}`);
  }

  const permError = requirePermission("fleet:vehicle:view", user);
  if (permError) redirect("/app/dashboard");

  if (!UUID_RE.test(id)) redirect("/app/fleet/vehicles" as never);

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, user.tenant_id)))
    .limit(1);

  if (!vehicle) redirect("/app/fleet/vehicles" as never);

  // Fetch WOs linked via vehicle's assetId
  const woRows = vehicle.assetId
    ? await db
        .select({
          id: workOrders.id,
          woNo: workOrders.woNo,
          type: workOrders.type,
          priority: workOrders.priority,
          status: workOrders.status,
          title: workOrders.title,
          scheduledDate: workOrders.scheduledDate,
          completedAt: workOrders.completedAt,
          totalCost: workOrders.totalCost,
          createdAt: workOrders.createdAt,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.assetId, vehicle.assetId!),
            eq(workOrders.tenantId, user.tenant_id)
          )
        )
        .orderBy(workOrders.createdAt)
    : [];

  // Fetch service schedules
  const schedules = await db
    .select()
    .from(vehicleServiceSchedules)
    .where(
      and(
        eq(vehicleServiceSchedules.vehicleId, id),
        eq(vehicleServiceSchedules.tenantId, user.tenant_id)
      )
    )
    .orderBy(vehicleServiceSchedules.serviceType);

  const canEdit = user.permissions.includes("fleet:vehicle:update");
  const canCreateWo = user.permissions.includes("rm:workorder:create");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{vehicle.regNumber}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ")}
        </p>
      </div>
      <VehicleDetailView
        vehicle={vehicle}
        workOrders={woRows}
        schedules={schedules}
        canEdit={canEdit}
        canCreateWo={canCreateWo}
      />
    </div>
  );
}
