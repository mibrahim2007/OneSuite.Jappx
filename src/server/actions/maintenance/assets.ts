"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { assets } from "@/lib/db/schema";
import { assetSchema } from "@/lib/validations/maintenance";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/maintenance/assets";

type ActionState = { success: true } | { success: false; error: string } | null;

function parseAssetForm(formData: FormData) {
  return assetSchema.safeParse({
    code: (formData.get("code") as string)?.trim(),
    name: (formData.get("name") as string)?.trim(),
    category: (formData.get("category") as string)?.trim() || null,
    parentId: (formData.get("parentId") as string) || null,
    location: (formData.get("location") as string)?.trim() || null,
    warehouseId: (formData.get("warehouseId") as string) || null,
    purchaseDate: (formData.get("purchaseDate") as string) || null,
    purchaseCost: (formData.get("purchaseCost") as string) || null,
    warrantyExpiry: (formData.get("warrantyExpiry") as string) || null,
    meterReading: (formData.get("meterReading") as string) || null,
    status: (formData.get("status") as string) || "active",
  });
}

export async function createAssetAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:asset:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { code, name, category, parentId, location, warehouseId, purchaseDate, purchaseCost, warrantyExpiry, meterReading, status } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { duplicate: boolean; id: string | null };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(assets)
          .values({
            tenantId: user.tenant_id,
            code,
            name,
            category: category ?? null,
            parentId: parentId ?? null,
            location: location ?? null,
            warehouseId: warehouseId ?? null,
            purchaseDate: purchaseDate ?? null,
            purchaseCost: purchaseCost ?? null,
            warrantyExpiry: warrantyExpiry ?? null,
            meterReading: meterReading ?? null,
            status,
          })
          .returning({ id: assets.id });
        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          return { duplicate: true, id: null as string | null };
        }
        throw err;
      }
    });
  } catch {
    return { success: false, error: "Failed to create asset." };
  }

  if (result.duplicate) return { success: false, error: "Asset code already in use." };

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "assets", entityId: result.id, action: "asset_created", changes: { code, name } });
  } catch { /* non-fatal */ }

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateAssetAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:asset:update", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid asset ID." };

  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, category, parentId, location, warehouseId, purchaseDate, purchaseCost, warrantyExpiry, meterReading, status } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: assets.id }).from(assets)
        .where(and(eq(assets.id, id), eq(assets.tenantId, user.tenant_id))).limit(1);
      if (!existing) { notFound = true; return; }
      await tx.update(assets).set({
        name, category: category ?? null, parentId: parentId ?? null,
        location: location ?? null, warehouseId: warehouseId ?? null,
        purchaseDate: purchaseDate ?? null, purchaseCost: purchaseCost ?? null,
        warrantyExpiry: warrantyExpiry ?? null, meterReading: meterReading ?? null,
        status, updatedAt: new Date(),
      }).where(and(eq(assets.id, id), eq(assets.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update asset." };
  }

  if (notFound) return { success: false, error: "Asset not found." };

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "assets", entityId: id, action: "asset_updated", changes: { name, status } });
  } catch { /* non-fatal */ }

  revalidatePath(REVALIDATE);
  revalidatePath(`/app/maintenance/assets/${id}`);
  return { success: true };
}
