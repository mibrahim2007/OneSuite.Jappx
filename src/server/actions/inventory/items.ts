"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { items } from "@/lib/db/schema";
import { itemSchema } from "@/lib/validations/inventory";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ItemActionState =
  | { success: true }
  | { success: false; error: string }
  | null;

function parseItemFormData(formData: FormData) {
  return itemSchema.safeParse({
    sku: (formData.get("sku") as string)?.trim(),
    name: (formData.get("name") as string)?.trim(),
    categoryId: (formData.get("categoryId") as string) || null,
    uomId: (formData.get("uomId") as string) || null,
    barcode: (formData.get("barcode") as string) || null,
    isStock: formData.get("isStock") === "true",
    valuation: (formData.get("valuation") as string) || "weighted_average",
    purchasePrice: (formData.get("purchasePrice") as string) || null,
    salePrice: (formData.get("salePrice") as string) || null,
    reorderLevel: (formData.get("reorderLevel") as string) || null,
    inventoryAccountId: (formData.get("inventoryAccountId") as string) || null,
  });
}

export async function createItemAction(
  _prevState: ItemActionState,
  formData: FormData
): Promise<ItemActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return permError;

  const parsed = parseItemFormData(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { sku, name, categoryId, uomId, barcode, isStock, valuation, purchasePrice, salePrice, reorderLevel, inventoryAccountId } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { duplicate: boolean; id: string | null };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(items)
          .values({
            tenantId: user.tenant_id,
            sku,
            name,
            categoryId: categoryId || null,
            uomId: uomId || null,
            barcode: barcode || null,
            isStock,
            valuation: valuation as "fifo" | "weighted_average" | "standard",
            purchasePrice: purchasePrice || null,
            salePrice: salePrice || null,
            reorderLevel: reorderLevel || null,
            inventoryAccountId: inventoryAccountId || null,
            isActive: true,
          })
          .returning({ id: items.id });
        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          return { duplicate: true, id: null as string | null };
        }
        throw err;
      }
    });
  } catch {
    return { success: false, error: "Failed to create item." };
  }

  if (result.duplicate) return { success: false, error: "SKU already in use." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "items",
      entityId: result.id,
      action: "item_created",
      changes: { sku, name },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/items");
  return { success: true };
}

export async function updateItemAction(
  _prevState: ItemActionState,
  formData: FormData
): Promise<ItemActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:item:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { success: false, error: "Item ID is required." };
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid item ID." };

  const parsed = parseItemFormData(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, categoryId, uomId, barcode, isStock, valuation, purchasePrice, salePrice, reorderLevel, inventoryAccountId } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, id), eq(items.tenantId, user.tenant_id), isNull(items.deletedAt)))
        .limit(1);
      if (!existing) return { notFound: true };

      await tx
        .update(items)
        .set({
          name,
          categoryId: categoryId || null,
          uomId: uomId || null,
          barcode: barcode || null,
          isStock,
          valuation: valuation as "fifo" | "weighted_average" | "standard",
          purchasePrice: purchasePrice || null,
          salePrice: salePrice || null,
          reorderLevel: reorderLevel || null,
          inventoryAccountId: inventoryAccountId || null,
          updatedAt: new Date(),
        })
        .where(and(eq(items.id, id), eq(items.tenantId, user.tenant_id)));

      return { notFound: false };
    });
  } catch {
    return { success: false, error: "Failed to update item." };
  }

  if (result.notFound) return { success: false, error: "Item not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "items",
      entityId: id,
      action: "item_updated",
      changes: { name },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/items");
  return { success: true };
}

export async function toggleItemActiveAction(
  itemId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(itemId)) return { success: false, error: "Invalid item ID." };

  const permError = requirePermission("scm:item:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, itemId), eq(items.tenantId, user.tenant_id), isNull(items.deletedAt)))
        .limit(1);
      if (!existing) return { notFound: true };

      await tx
        .update(items)
        .set({ isActive, updatedAt: new Date() })
        .where(and(eq(items.id, itemId), eq(items.tenantId, user.tenant_id)));

      return { notFound: false };
    });
  } catch {
    return { success: false, error: "Failed to update item." };
  }

  if (result.notFound) return { success: false, error: "Item not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "items",
      entityId: itemId,
      action: isActive ? "item_activated" : "item_deactivated",
      changes: { isActive },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/items");
  return { success: true };
}
