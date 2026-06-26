import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { stockMoves, items, warehouses } from "@/lib/db/schema";
import { StockMovementsView } from "@/components/app/inventory/stock-movements-view";

export default async function StockMovementsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/inventory/stock-movements");
  }

  const permError = requirePermission("scm:inventory:view", user);
  if (permError) redirect("/app/dashboard");

  const fromWh = alias(warehouses, "from_wh");
  const toWh = alias(warehouses, "to_wh");

  const [moves, activeItems, activeWarehouses] = await Promise.all([
    db
      .select({
        id: stockMoves.id,
        moveType: stockMoves.moveType,
        itemId: stockMoves.itemId,
        warehouseId: stockMoves.warehouseId,
        toWarehouseId: stockMoves.toWarehouseId,
        quantity: stockMoves.quantity,
        unitCost: stockMoves.unitCost,
        reference: stockMoves.reference,
        moveDate: stockMoves.moveDate,
        createdBy: stockMoves.createdBy,
        itemSku: items.sku,
        itemName: items.name,
        fromWarehouseName: fromWh.name,
        toWarehouseName: toWh.name,
      })
      .from(stockMoves)
      .innerJoin(items, eq(stockMoves.itemId, items.id))
      .innerJoin(fromWh, eq(stockMoves.warehouseId, fromWh.id))
      .leftJoin(toWh, eq(stockMoves.toWarehouseId, toWh.id))
      .where(eq(stockMoves.tenantId, user.tenant_id))
      .orderBy(desc(stockMoves.moveDate), desc(stockMoves.id))
      .limit(200),
    db
      .select({ id: items.id, sku: items.sku, name: items.name })
      .from(items)
      .where(
        and(
          eq(items.tenantId, user.tenant_id),
          eq(items.isActive, true),
          isNull(items.deletedAt),
          eq(items.isStock, true)
        )
      )
      .orderBy(items.sku),
    db
      .select({ id: warehouses.id, name: warehouses.name, code: warehouses.code })
      .from(warehouses)
      .where(and(eq(warehouses.tenantId, user.tenant_id), eq(warehouses.isActive, true)))
      .orderBy(warehouses.code),
  ]);

  const canCreate = user.permissions.includes("scm:inventory:adjust");
  const canTransfer = user.permissions.includes("scm:transfer:create");

  return (
    <div className="p-6">
      <StockMovementsView
        moves={moves}
        activeItems={activeItems}
        activeWarehouses={activeWarehouses}
        canCreate={canCreate}
        canTransfer={canTransfer}
      />
    </div>
  );
}
