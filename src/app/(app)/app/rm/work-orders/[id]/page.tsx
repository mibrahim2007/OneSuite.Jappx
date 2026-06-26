import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { workOrders, woTasks, woParts, assets, items, warehouses } from "@/lib/db/schema";
import { WorkOrderDetail } from "@/components/app/maintenance/work-order-detail";

export default async function WorkOrderDetailPage({
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
    redirect(`/api/auth/refresh?next=/app/rm/work-orders/${id}`);
  }

  const permError = requirePermission("rm:workorder:view", user);
  if (permError) redirect("/app/dashboard");

  const [woRows, tasks, parts, assetRows, itemRows, warehouseRows] = await Promise.all([
    db.select().from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, user.tenant_id)))
      .limit(1),
    db.select().from(woTasks)
      .where(and(eq(woTasks.workOrderId, id), eq(woTasks.tenantId, user.tenant_id)))
      .orderBy(asc(woTasks.id)),
    db.select().from(woParts)
      .where(and(eq(woParts.workOrderId, id), eq(woParts.tenantId, user.tenant_id)))
      .orderBy(asc(woParts.id)),
    db.select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(eq(assets.tenantId, user.tenant_id))
      .orderBy(asc(assets.code)),
    db.select({ id: items.id, sku: items.sku, name: items.name })
      .from(items)
      .where(eq(items.tenantId, user.tenant_id))
      .orderBy(asc(items.sku)),
    db.select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.tenantId, user.tenant_id))
      .orderBy(asc(warehouses.name)),
  ]);

  const wo = woRows[0];
  if (!wo) notFound();

  const canEdit = user.permissions.includes("rm:workorder:update");
  const canClose = user.permissions.includes("rm:workorder:close");
  const canConsumeParts = user.permissions.includes("rm:parts:consume");

  return (
    <div className="p-6">
      <WorkOrderDetail
        wo={wo}
        tasks={tasks}
        parts={parts}
        assets={assetRows}
        items={itemRows}
        warehouses={warehouseRows}
        canEdit={canEdit}
        canClose={canClose}
        canConsumeParts={canConsumeParts}
      />
    </div>
  );
}
