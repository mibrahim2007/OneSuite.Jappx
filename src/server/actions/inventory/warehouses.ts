"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { warehouses } from "@/lib/db/schema";
import { warehouseSchema, updateWarehouseSchema } from "@/lib/validations/inventory";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/inventory/warehouses";

type ActionState = { success: true } | { success: false; error: string } | null;

export async function createWarehouseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:inventory:adjust", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = warehouseSchema.safeParse({
    code: (formData.get("code") as string)?.trim().toUpperCase(),
    name: (formData.get("name") as string)?.trim(),
    location: (formData.get("location") as string)?.trim() || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { code, name, location } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let warehouseId: string;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(warehouses)
          .values({ tenantId: user.tenant_id, code, name, location: location ?? null })
          .returning({ id: warehouses.id });
        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          return { duplicate: true, id: "" };
        }
        throw err;
      }
    });
    if (result.duplicate) return { success: false, error: "Warehouse code already in use." };
    warehouseId = result.id;
  } catch {
    return { success: false, error: "Failed to create warehouse." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "warehouses",
      entityId: warehouseId,
      action: "warehouse_created",
      changes: { code, name, location },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateWarehouseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:inventory:adjust", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { success: false, error: "Warehouse ID is required." };
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid warehouse ID." };

  const parsed = updateWarehouseSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    location: (formData.get("location") as string)?.trim() || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, location } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.id, id), eq(warehouses.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return { notFound: true };

      await tx
        .update(warehouses)
        .set({ name, location: location ?? null })
        .where(and(eq(warehouses.id, id), eq(warehouses.tenantId, user.tenant_id)));

      return { notFound: false };
    });
    notFound = result.notFound;
  } catch {
    return { success: false, error: "Failed to update warehouse." };
  }

  if (notFound) return { success: false, error: "Warehouse not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "warehouses",
      entityId: id,
      action: "warehouse_updated",
      changes: { name, location },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function toggleWarehouseActiveAction(
  warehouseId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(warehouseId)) return { success: false, error: "Invalid warehouse ID." };

  const permError = requirePermission("scm:inventory:adjust", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.id, warehouseId), eq(warehouses.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return { notFound: true };

      await tx
        .update(warehouses)
        .set({ isActive })
        .where(and(eq(warehouses.id, warehouseId), eq(warehouses.tenantId, user.tenant_id)));

      return { notFound: false };
    });
    notFound = result.notFound;
  } catch {
    return { success: false, error: "Failed to update warehouse." };
  }

  if (notFound) return { success: false, error: "Warehouse not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "warehouses",
      entityId: warehouseId,
      action: isActive ? "warehouse_activated" : "warehouse_deactivated",
      changes: { isActive },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE);
  return { success: true };
}
