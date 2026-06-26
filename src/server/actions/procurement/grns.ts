"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { grns, grnLines, purchaseOrders, poLines, stockLevels, stockMoves } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";
import { grnSchema } from "@/lib/validations/procurement";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE_GRN = "/app/procurement/grns";
const REVALIDATE_PO = "/app/procurement/purchase-orders";
const REVALIDATE_INV = "/app/inventory";

type ActionState = { success: true } | { success: false; error: string } | null;

export async function createGrnAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:grn:create", user);
  if (permError) return { success: false, error: permError.error };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse((formData.get("lines") as string) || "[]");
  } catch {
    return { success: false, error: "Invalid lines data." };
  }

  const parsed = grnSchema.safeParse({
    grnNo: (formData.get("grnNo") as string)?.trim(),
    poId: (formData.get("poId") as string)?.trim() || null,
    warehouseId: formData.get("warehouseId"),
    receiptDate: formData.get("receiptDate"),
    lines: rawLines,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { grnNo, poId, warehouseId, receiptDate, lines } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let grnId: string;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(grns)
          .values({
            tenantId: user.tenant_id,
            grnNo,
            poId: poId ?? null,
            warehouseId,
            receiptDate,
            status: "draft",
            createdBy: user.sub,
          })
          .returning({ id: grns.id });

        await tx.insert(grnLines).values(
          lines.map((l) => ({
            tenantId: user.tenant_id,
            grnId: inserted!.id,
            poLineId: l.poLineId ?? null,
            itemId: l.itemId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          }))
        );

        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "23505"
        ) {
          return { duplicate: true, id: "" };
        }
        throw err;
      }
    });
    if (result.duplicate) return { success: false, error: "GRN No already in use." };
    grnId = result.id;
  } catch {
    return { success: false, error: "Failed to create GRN." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "grns",
      entityId: grnId,
      action: "grn_created",
      changes: { grnNo, warehouseId, receiptDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_GRN);
  return { success: true };
}

export async function postGrnAction(
  grnId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(grnId)) return { success: false, error: "Invalid GRN ID." };

  const permError = requirePermission("scm:grn:create", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let error: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      // Fetch GRN header
      const [grn] = await tx
        .select()
        .from(grns)
        .where(and(eq(grns.id, grnId), eq(grns.tenantId, user.tenant_id)))
        .limit(1);

      if (!grn) { error = "GRN not found."; return; }
      if (grn.status !== "draft") { error = "Only draft GRNs can be posted."; return; }

      // Fetch lines
      const lines = await tx
        .select()
        .from(grnLines)
        .where(and(eq(grnLines.grnId, grnId), eq(grnLines.tenantId, user.tenant_id)));

      if (lines.length === 0) { error = "GRN has no lines."; return; }

      // Process each line: WAC upsert + stock move
      for (const line of lines) {
        const qty = parseFloat(line.quantity);
        const cost = parseFloat(line.unitCost);

        const [level] = await tx
          .select({ quantity: stockLevels.quantity, avgCost: stockLevels.avgCost })
          .from(stockLevels)
          .where(
            and(
              eq(stockLevels.itemId, line.itemId),
              eq(stockLevels.warehouseId, grn.warehouseId),
              eq(stockLevels.tenantId, user.tenant_id)
            )
          )
          .limit(1);

        const oldQty = parseFloat(level?.quantity ?? "0");
        const oldAvg = parseFloat(level?.avgCost ?? "0");
        const newQty = oldQty + qty;
        const newAvg =
          oldQty === 0 ? cost : (oldQty * oldAvg + qty * cost) / (oldQty + qty);

        await tx
          .insert(stockLevels)
          .values({
            tenantId: user.tenant_id,
            itemId: line.itemId,
            warehouseId: grn.warehouseId,
            quantity: String(newQty),
            avgCost: String(newAvg),
          })
          .onConflictDoUpdate({
            target: [stockLevels.tenantId, stockLevels.itemId, stockLevels.warehouseId],
            set: { quantity: String(newQty), avgCost: String(newAvg) },
          });

        await tx.insert(stockMoves).values({
          tenantId: user.tenant_id,
          moveType: "receipt",
          itemId: line.itemId,
          warehouseId: grn.warehouseId,
          toWarehouseId: null,
          quantity: String(qty),
          unitCost: String(cost),
          reference: grn.grnNo,
          moveDate: grn.receiptDate,
          createdBy: user.sub,
        });

        // Increment received_qty on the linked PO line if present
        if (line.poLineId && UUID_RE.test(line.poLineId)) {
          const [poLine] = await tx
            .select({ receivedQty: poLines.receivedQty, quantity: poLines.quantity })
            .from(poLines)
            .where(
              and(eq(poLines.id, line.poLineId), eq(poLines.tenantId, user.tenant_id))
            )
            .limit(1);
          if (poLine) {
            const newReceivedQty = parseFloat(poLine.receivedQty) + qty;
            if (newReceivedQty > parseFloat(poLine.quantity)) {
              error = `GRN line quantity exceeds PO ordered quantity for item ${line.itemId}.`;
              return;
            }
            await tx
              .update(poLines)
              .set({ receivedQty: String(newReceivedQty) })
              .where(
                and(eq(poLines.id, line.poLineId), eq(poLines.tenantId, user.tenant_id))
              );
          }
        }
      }

      // Mark GRN as posted
      await tx
        .update(grns)
        .set({ status: "posted" })
        .where(and(eq(grns.id, grnId), eq(grns.tenantId, user.tenant_id)));

      // Update linked PO status
      if (grn.poId && UUID_RE.test(grn.poId)) {
        const poLineRows = await tx
          .select({ quantity: poLines.quantity, receivedQty: poLines.receivedQty })
          .from(poLines)
          .where(and(eq(poLines.poId, grn.poId), eq(poLines.tenantId, user.tenant_id)));

        if (poLineRows.length > 0) {
          const allReceived = poLineRows.every(
            (r) => parseFloat(r.receivedQty) >= parseFloat(r.quantity)
          );
          const anyReceived = poLineRows.some((r) => parseFloat(r.receivedQty) > 0);
          const newPoStatus = allReceived ? "received" : anyReceived ? "partial" : "approved";

          await tx
            .update(purchaseOrders)
            .set({
              status: newPoStatus as "received" | "partial" | "approved",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(purchaseOrders.id, grn.poId),
                eq(purchaseOrders.tenantId, user.tenant_id)
              )
            );
        }
      }
    });
  } catch {
    return { success: false, error: "Failed to post GRN." };
  }

  if (error) return { success: false, error };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "grns",
      entityId: grnId,
      action: "grn_posted",
      changes: { status: "posted" },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_GRN);
  revalidatePath(REVALIDATE_PO);
  revalidatePath(REVALIDATE_INV);
  return { success: true };
}

export async function cancelGrnAction(
  grnId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(grnId)) return { success: false, error: "Invalid GRN ID." };

  const permError = requirePermission("scm:grn:create", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let error: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [grn] = await tx
        .select({ status: grns.status })
        .from(grns)
        .where(and(eq(grns.id, grnId), eq(grns.tenantId, user.tenant_id)))
        .limit(1);

      if (!grn) { error = "GRN not found."; return; }
      if (grn.status !== "draft") { error = "Only draft GRNs can be cancelled."; return; }

      await tx
        .update(grns)
        .set({ status: "cancelled" })
        .where(and(eq(grns.id, grnId), eq(grns.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to cancel GRN." };
  }

  if (error) return { success: false, error };

  revalidatePath(REVALIDATE_GRN);
  return { success: true };
}
