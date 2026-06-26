"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { purchaseOrders, poLines, requisitions } from "@/lib/db/schema";
import { taxRates } from "@/lib/db/schema/settings";
import { createAuditLog } from "@/lib/audit";
import { purchaseOrderSchema } from "@/lib/validations/procurement";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE_PO = "/app/procurement/purchase-orders";
const REVALIDATE_REQ = "/app/procurement/requisitions";

type ActionState = { success: true } | { success: false; error: string } | null;

export async function createPurchaseOrderAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:po:create", user);
  if (permError) return { success: false, error: permError.error };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse((formData.get("lines") as string) || "[]");
  } catch {
    return { success: false, error: "Invalid lines data." };
  }

  const fromReqIdRaw = (formData.get("fromReqId") as string)?.trim() || null;
  const parsed = purchaseOrderSchema.safeParse({
    poNo: (formData.get("poNo") as string)?.trim(),
    vendorId: formData.get("vendorId"),
    orderDate: formData.get("orderDate"),
    expectedDate: (formData.get("expectedDate") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
    fromReqId: fromReqIdRaw,
    lines: rawLines,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { poNo, vendorId, orderDate, expectedDate, notes, fromReqId, lines } = parsed.data;

  if (fromReqId && !UUID_RE.test(fromReqId)) {
    return { success: false, error: "Invalid requisition reference." };
  }

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let poId: string;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      // Batch-fetch all needed tax rates
      const taxRateIds = lines.map((l) => l.taxRateId).filter((id): id is string => !!id);
      const taxRateMap = new Map<string, number>();
      if (taxRateIds.length > 0) {
        const rows = await tx
          .select({ id: taxRates.id, rate: taxRates.rate })
          .from(taxRates)
          .where(and(inArray(taxRates.id, taxRateIds), eq(taxRates.tenantId, user.tenant_id)));
        for (const row of rows) taxRateMap.set(row.id, parseFloat(row.rate));
      }

      // Compute totals
      let subtotal = 0;
      let taxTotal = 0;
      const lineRows = lines.map((l) => {
        const qty = parseFloat(l.quantity);
        const price = parseFloat(l.unitPrice);
        const lineTotal = qty * price;
        subtotal += lineTotal;
        const taxRate = l.taxRateId ? (taxRateMap.get(l.taxRateId) ?? 0) : 0;
        taxTotal += lineTotal * (taxRate / 100);
        return { qty, price, lineTotal, taxRateId: l.taxRateId ?? null, itemId: l.itemId };
      });

      try {
        const [inserted] = await tx
          .insert(purchaseOrders)
          .values({
            tenantId: user.tenant_id,
            poNo,
            vendorId,
            orderDate,
            expectedDate: expectedDate ?? null,
            status: "draft",
            subtotal: String(subtotal.toFixed(4)),
            taxTotal: String(taxTotal.toFixed(4)),
            total: String((subtotal + taxTotal).toFixed(4)),
            notes: notes ?? null,
            createdBy: user.sub,
          })
          .returning({ id: purchaseOrders.id });

        await tx.insert(poLines).values(
          lineRows.map((l) => ({
            tenantId: user.tenant_id,
            poId: inserted!.id,
            itemId: l.itemId,
            quantity: String(l.qty),
            unitPrice: String(l.price),
            taxRateId: l.taxRateId,
            lineTotal: String(l.lineTotal.toFixed(4)),
          }))
        );

        if (fromReqId) {
          await tx
            .update(requisitions)
            .set({ status: "converted" })
            .where(
              and(eq(requisitions.id, fromReqId), eq(requisitions.tenantId, user.tenant_id))
            );
        }

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
    if (result.duplicate) return { success: false, error: "PO No already in use." };
    poId = result.id;
  } catch {
    return { success: false, error: "Failed to create purchase order." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "purchase_orders",
      entityId: poId,
      action: "po_created",
      changes: { poNo, vendorId, orderDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PO);
  if (fromReqId) revalidatePath(REVALIDATE_REQ);
  return { success: true };
}

export async function updatePoStatusAction(
  id: string,
  newStatus: "submitted" | "approved" | "cancelled"
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(id)) return { success: false, error: "Invalid PO ID." };

  const perm = newStatus === "approved" ? "scm:po:approve" : "scm:po:create";
  const permError = requirePermission(perm, user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let error: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [po] = await tx
        .select({ status: purchaseOrders.status })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, user.tenant_id)))
        .limit(1);

      if (!po) { error = "Purchase order not found."; return; }

      const validFrom: Record<string, string[]> = {
        submitted: ["draft"],
        approved: ["submitted"],
        cancelled: ["submitted", "approved"],
      };
      if (!validFrom[newStatus]?.includes(po.status)) {
        error = `Cannot move from ${po.status} to ${newStatus}.`;
        return;
      }

      await tx
        .update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update PO status." };
  }

  if (error) return { success: false, error };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "purchase_orders",
      entityId: id,
      action: `po_${newStatus}`,
      changes: { status: newStatus },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PO);
  return { success: true };
}
