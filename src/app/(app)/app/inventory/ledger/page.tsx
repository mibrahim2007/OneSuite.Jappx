import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { stockMoves, items, warehouses } from "@/lib/db/schema";
import { StockLedger } from "@/components/app/inventory/stock-ledger";
import { MOVE_TYPES, type MoveType } from "@/lib/validations/inventory";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function StockLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/inventory/ledger");
  }

  const permError = requirePermission("scm:inventory:view", user);
  if (permError) redirect("/app/dashboard");

  const params = await searchParams;
  const itemFilter = typeof params.item === "string" ? params.item : "";
  const warehouseFilter = typeof params.warehouse === "string" ? params.warehouse : "";
  const typeFilter = typeof params.type === "string" ? params.type : "";
  const fromDate = typeof params.from === "string" ? params.from : "";
  const toDate = typeof params.to === "string" ? params.to : "";

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const conditions = [eq(stockMoves.tenantId, user.tenant_id)];
  if (itemFilter && UUID_RE.test(itemFilter)) conditions.push(eq(stockMoves.itemId, itemFilter));
  if (warehouseFilter && UUID_RE.test(warehouseFilter))
    conditions.push(eq(stockMoves.warehouseId, warehouseFilter));
  if (typeFilter && (MOVE_TYPES as readonly string[]).includes(typeFilter))
    conditions.push(eq(stockMoves.moveType, typeFilter as MoveType));
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate))
    conditions.push(gte(stockMoves.moveDate, fromDate));
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate))
    conditions.push(lte(stockMoves.moveDate, toDate));

  const fromWh = alias(warehouses, "from_wh");
  const toWh = alias(warehouses, "to_wh");

  const [moves, allItems, allWarehouses] = await Promise.all([
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
        itemSku: items.sku,
        itemName: items.name,
        fromWarehouseName: fromWh.name,
        toWarehouseName: toWh.name,
      })
      .from(stockMoves)
      .innerJoin(items, eq(stockMoves.itemId, items.id))
      .innerJoin(fromWh, eq(stockMoves.warehouseId, fromWh.id))
      .leftJoin(toWh, eq(stockMoves.toWarehouseId, toWh.id))
      .where(and(...conditions))
      .orderBy(desc(stockMoves.moveDate), desc(stockMoves.id))
      .limit(200),
    db
      .select({ id: items.id, sku: items.sku, name: items.name })
      .from(items)
      .where(eq(items.tenantId, user.tenant_id))
      .orderBy(items.sku),
    db
      .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.tenantId, user.tenant_id))
      .orderBy(warehouses.code),
  ]);

  return (
    <div className="p-6">
      <StockLedger
        moves={moves}
        allItems={allItems}
        allWarehouses={allWarehouses}
        filters={{ item: itemFilter, warehouse: warehouseFilter, type: typeFilter, from: fromDate, to: toDate }}
      />
    </div>
  );
}
