import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { stockLevels, items, uoms, warehouses } from "@/lib/db/schema";
import { InventoryOverview } from "@/components/app/inventory/inventory-overview";

export default async function InventoryPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/inventory");
  }

  const permError = requirePermission("scm:inventory:view", user);
  if (permError) redirect("/app/dashboard");

  const [overview, allWarehouses] = await Promise.all([
    db
      .select({
        itemId: stockLevels.itemId,
        totalQty: sql<string>`SUM(${stockLevels.quantity})`,
        avgCost: sql<string>`AVG(${stockLevels.avgCost})`,
        sku: items.sku,
        name: items.name,
        reorderLevel: items.reorderLevel,
        uomCode: uoms.code,
      })
      .from(stockLevels)
      .innerJoin(items, eq(stockLevels.itemId, items.id))
      .leftJoin(uoms, eq(items.uomId, uoms.id))
      .where(
        and(
          eq(stockLevels.tenantId, user.tenant_id),
          eq(items.isActive, true),
          isNull(items.deletedAt)
        )
      )
      .groupBy(stockLevels.itemId, items.sku, items.name, items.reorderLevel, uoms.code)
      .orderBy(items.sku),
    db
      .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses)
      .where(and(eq(warehouses.tenantId, user.tenant_id), eq(warehouses.isActive, true)))
      .orderBy(warehouses.code),
  ]);

  return (
    <div className="p-6">
      <InventoryOverview rows={overview} warehouses={allWarehouses} tenantId={user.tenant_id} />
    </div>
  );
}
