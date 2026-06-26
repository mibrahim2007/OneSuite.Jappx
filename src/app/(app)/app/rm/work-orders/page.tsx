import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { workOrders, assets } from "@/lib/db/schema";
import { WorkOrdersTable } from "@/components/app/maintenance/work-orders-table";

export default async function WorkOrdersPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/rm/work-orders");
  }

  const permError = requirePermission("rm:workorder:view", user);
  if (permError) redirect("/app/dashboard");

  const [woRows, assetRows] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        woNo: workOrders.woNo,
        assetId: workOrders.assetId,
        type: workOrders.type,
        priority: workOrders.priority,
        status: workOrders.status,
        title: workOrders.title,
        description: workOrders.description,
        reportedBy: workOrders.reportedBy,
        assignedTo: workOrders.assignedTo,
        scheduledDate: workOrders.scheduledDate,
        completedAt: workOrders.completedAt,
        laborHours: workOrders.laborHours,
        laborCost: workOrders.laborCost,
        partsCost: workOrders.partsCost,
        totalCost: workOrders.totalCost,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
      })
      .from(workOrders)
      .where(eq(workOrders.tenantId, user.tenant_id))
      .orderBy(asc(workOrders.createdAt)),
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(eq(assets.tenantId, user.tenant_id))
      .orderBy(asc(assets.code)),
  ]);

  const canCreate = user.permissions.includes("rm:workorder:create");
  const canEdit = user.permissions.includes("rm:workorder:update");
  const canClose = user.permissions.includes("rm:workorder:close");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Work Orders</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Corrective, preventive, and inspection work orders.
      </p>
      <div className="mt-6">
        <WorkOrdersTable
          workOrders={woRows}
          assets={assetRows}
          canCreate={canCreate}
          canEdit={canEdit}
          canClose={canClose}
        />
      </div>
    </div>
  );
}
