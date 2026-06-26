"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { stockMoves, stockLevels } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";
import { stockMoveSchema } from "@/lib/validations/inventory";

type StockMoveState =
  | { success: true }
  | { success: false; error: string }
  | null;

export async function createStockMoveAction(
  _prevState: StockMoveState,
  formData: FormData
): Promise<StockMoveState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const rawMoveType = formData.get("moveType") as string;
  const perm = rawMoveType === "transfer" ? "scm:transfer:create" : "scm:inventory:adjust";
  const permError = requirePermission(perm, user);
  if (permError) return { success: false, error: permError.error };

  const parsed = stockMoveSchema.safeParse({
    moveType: formData.get("moveType"),
    itemId: formData.get("itemId"),
    warehouseId: formData.get("warehouseId"),
    toWarehouseId: (formData.get("toWarehouseId") as string) || null,
    quantity: formData.get("quantity"),
    unitCost: (formData.get("unitCost") as string) || null,
    reference: (formData.get("reference") as string) || null,
    moveDate: formData.get("moveDate"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { moveType, itemId, warehouseId, toWarehouseId, quantity, unitCost, reference, moveDate } =
    parsed.data;

  if (!UUID_RE.test(itemId)) return { success: false, error: "Invalid item ID." };
  if (!UUID_RE.test(warehouseId)) return { success: false, error: "Invalid warehouse ID." };
  if (toWarehouseId && !UUID_RE.test(toWarehouseId))
    return { success: false, error: "Invalid destination warehouse ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let innerResult: { ok: boolean; error?: string };
  try {
    innerResult = await withTenantRLS(ctx, async (tx) => {
      const moveQty = parseFloat(quantity);

      // Fetch current stock level for source warehouse
      const [level] = await tx
        .select({ quantity: stockLevels.quantity, avgCost: stockLevels.avgCost })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.itemId, itemId),
            eq(stockLevels.warehouseId, warehouseId),
            eq(stockLevels.tenantId, user.tenant_id)
          )
        )
        .limit(1);

      const currentQty = parseFloat(level?.quantity ?? "0");
      const currentAvg = parseFloat(level?.avgCost ?? "0");

      // Check for insufficient stock on deductions
      const isDeduction =
        moveType === "issue" ||
        moveType === "transfer" ||
        (moveType === "adjustment" && moveQty < 0);

      if (isDeduction && currentQty < Math.abs(moveQty)) {
        return {
          ok: false as const,
          error: `Insufficient stock. Available: ${currentQty.toFixed(4)}.`,
        };
      }

      // Calculate new quantity and avg cost for source warehouse
      const qtyDelta = isDeduction ? -Math.abs(moveQty) : moveQty;
      const newSourceQty = currentQty + qtyDelta;

      let newAvgCost = currentAvg;
      if ((moveType === "receipt" || moveType === "return") && unitCost) {
        const cost = parseFloat(unitCost);
        newAvgCost =
          currentQty === 0
            ? cost
            : (currentQty * currentAvg + moveQty * cost) / (currentQty + moveQty);
      }

      // Upsert stock_levels for source warehouse
      await tx
        .insert(stockLevels)
        .values({
          tenantId: user.tenant_id,
          itemId,
          warehouseId,
          quantity: String(newSourceQty),
          avgCost: String(newAvgCost),
        })
        .onConflictDoUpdate({
          target: [stockLevels.tenantId, stockLevels.itemId, stockLevels.warehouseId],
          set: { quantity: String(newSourceQty), avgCost: String(newAvgCost) },
        });

      // For transfers: upsert destination stock_levels
      if (moveType === "transfer" && toWarehouseId) {
        const [destLevel] = await tx
          .select({ quantity: stockLevels.quantity })
          .from(stockLevels)
          .where(
            and(
              eq(stockLevels.itemId, itemId),
              eq(stockLevels.warehouseId, toWarehouseId),
              eq(stockLevels.tenantId, user.tenant_id)
            )
          )
          .limit(1);

        const destQty = parseFloat(destLevel?.quantity ?? "0") + moveQty;

        await tx
          .insert(stockLevels)
          .values({
            tenantId: user.tenant_id,
            itemId,
            warehouseId: toWarehouseId,
            quantity: String(destQty),
            avgCost: String(newAvgCost),
          })
          .onConflictDoUpdate({
            target: [stockLevels.tenantId, stockLevels.itemId, stockLevels.warehouseId],
            set: { quantity: String(destQty) },
          });
      }

      // Insert the stock move record
      await tx.insert(stockMoves).values({
        tenantId: user.tenant_id,
        moveType,
        itemId,
        warehouseId,
        toWarehouseId: moveType === "transfer" ? (toWarehouseId ?? null) : null,
        quantity: String(Math.abs(moveQty)),
        unitCost: unitCost ?? null,
        reference: reference ?? null,
        moveDate,
        createdBy: user.sub,
      });

      return { ok: true as const };
    });
  } catch {
    return { success: false, error: "Failed to record stock movement." };
  }

  if (!innerResult.ok) return { success: false, error: innerResult.error ?? "Failed." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "stock_moves",
      action: "stock_move_created",
      changes: { moveType, itemId, warehouseId, quantity, moveDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/stock-movements");
  revalidatePath("/app/inventory");
  return { success: true };
}
