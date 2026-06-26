"use server";

import { and, desc, eq, isNull } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { db } from "@/lib/db";
import { stockLevels, stockMoves, items, warehouses } from "@/lib/db/schema";

type BreakdownRow = {
  warehouseId: string;
  warehouseName: string;
  quantity: string;
  avgCost: string;
};

type MoveRow = {
  id: string;
  moveType: string;
  quantity: string;
  unitCost: string | null;
  reference: string | null;
  moveDate: string;
  fromWarehouseName: string;
  toWarehouseId: string | null;
};

type ItemBreakdownResult =
  | { success: false; error: string }
  | { success: true; breakdown: BreakdownRow[]; moves: MoveRow[] };

export async function getItemBreakdownAction(itemId: string): Promise<ItemBreakdownResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(itemId)) return { success: false, error: "Invalid item ID." };

  const [breakdown, moves] = await Promise.all([
    db
      .select({
        warehouseId: stockLevels.warehouseId,
        warehouseName: warehouses.name,
        quantity: stockLevels.quantity,
        avgCost: stockLevels.avgCost,
      })
      .from(stockLevels)
      .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
      .where(
        and(eq(stockLevels.itemId, itemId), eq(stockLevels.tenantId, user.tenant_id))
      )
      .orderBy(warehouses.name),
    db
      .select({
        id: stockMoves.id,
        moveType: stockMoves.moveType,
        quantity: stockMoves.quantity,
        unitCost: stockMoves.unitCost,
        reference: stockMoves.reference,
        moveDate: stockMoves.moveDate,
        fromWarehouseName: warehouses.name,
        toWarehouseId: stockMoves.toWarehouseId,
      })
      .from(stockMoves)
      .innerJoin(warehouses, eq(stockMoves.warehouseId, warehouses.id))
      .where(
        and(eq(stockMoves.itemId, itemId), eq(stockMoves.tenantId, user.tenant_id))
      )
      .orderBy(desc(stockMoves.moveDate), desc(stockMoves.id))
      .limit(50),
  ]);

  return { success: true, breakdown, moves };
}
