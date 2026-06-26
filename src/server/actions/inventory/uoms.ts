"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { uoms, items } from "@/lib/db/schema";
import { uomSchema } from "@/lib/validations/inventory";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UomActionState =
  | { success: true }
  | { success: false; error: string }
  | null;

export async function createUomAction(
  _prevState: UomActionState,
  formData: FormData
): Promise<UomActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return permError;

  const parsed = uomSchema.safeParse({
    code: (formData.get("code") as string)?.toUpperCase().trim(),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { code, name } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { duplicate: boolean; id: string | null };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(uoms)
          .values({ tenantId: user.tenant_id, code, name })
          .returning({ id: uoms.id });
        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && err.code === "23505") {
          return { duplicate: true, id: null as string | null };
        }
        throw err;
      }
    });
  } catch {
    return { success: false, error: "Failed to create unit of measure." };
  }

  if (result.duplicate) return { success: false, error: "A UoM with this code already exists." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "uoms",
      entityId: result.id,
      action: "uom_created",
      changes: { code, name },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/settings");
  return { success: true };
}

export async function updateUomAction(
  _prevState: UomActionState,
  formData: FormData
): Promise<UomActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { success: false, error: "UoM ID is required." };
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid UoM ID." };

  const parsed = uomSchema.safeParse({
    code: (formData.get("code") as string)?.toUpperCase().trim(),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { code, name } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    notFound = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: uoms.id })
        .from(uoms)
        .where(and(eq(uoms.id, id), eq(uoms.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return true;

      await tx
        .update(uoms)
        .set({ code, name })
        .where(and(eq(uoms.id, id), eq(uoms.tenantId, user.tenant_id)));
      return false;
    });
  } catch {
    return { success: false, error: "Failed to update unit of measure." };
  }

  if (notFound) return { success: false, error: "Unit of measure not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "uoms",
      entityId: id,
      action: "uom_updated",
      changes: { code, name },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/settings");
  return { success: true };
}

export async function deleteUomAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(id)) return { success: false, error: "Invalid UoM ID." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean; inUse: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: uoms.id })
        .from(uoms)
        .where(and(eq(uoms.id, id), eq(uoms.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return { notFound: true, inUse: false };

      const [usedItem] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.uomId, id), eq(items.tenantId, user.tenant_id)))
        .limit(1);
      if (usedItem) return { notFound: false, inUse: true };

      await tx
        .delete(uoms)
        .where(and(eq(uoms.id, id), eq(uoms.tenantId, user.tenant_id)));
      return { notFound: false, inUse: false };
    });
  } catch {
    return { success: false, error: "Failed to delete unit of measure." };
  }

  if (result.notFound) return { success: false, error: "Unit of measure not found." };
  if (result.inUse) return { success: false, error: "This UoM is used by existing items." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "uoms",
      entityId: id,
      action: "uom_deleted",
      changes: {},
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/settings");
  return { success: true };
}
