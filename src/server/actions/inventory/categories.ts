"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { itemCategories, items } from "@/lib/db/schema";
import { categorySchema } from "@/lib/validations/inventory";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CategoryActionState =
  | { success: true }
  | { success: false; error: string }
  | null;

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return permError;

  const rawParentId = (formData.get("parentId") as string)?.trim() || null;
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    parentId: rawParentId || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, parentId } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let insertedId: string | null = null;
  try {
    insertedId = await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx
        .insert(itemCategories)
        .values({
          tenantId: user.tenant_id,
          name,
          parentId: parentId ?? null,
        })
        .returning({ id: itemCategories.id });
      return inserted!.id;
    });
  } catch {
    return { success: false, error: "Failed to create category." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "item_categories",
      entityId: insertedId,
      action: "category_created",
      changes: { name, parentId },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/settings");
  return { success: true };
}

export async function updateCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { success: false, error: "Category ID is required." };
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid category ID." };

  const rawParentId = (formData.get("parentId") as string)?.trim() || null;
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    parentId: rawParentId || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, parentId } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    notFound = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: itemCategories.id })
        .from(itemCategories)
        .where(and(eq(itemCategories.id, id), eq(itemCategories.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return true;

      await tx
        .update(itemCategories)
        .set({ name, parentId: parentId ?? null })
        .where(and(eq(itemCategories.id, id), eq(itemCategories.tenantId, user.tenant_id)));
      return false;
    });
  } catch {
    return { success: false, error: "Failed to update category." };
  }

  if (notFound) return { success: false, error: "Category not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "item_categories",
      entityId: id,
      action: "category_updated",
      changes: { name, parentId },
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/settings");
  return { success: true };
}

export async function deleteCategoryAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(id)) return { success: false, error: "Invalid category ID." };

  const permError = requirePermission("scm:item:create", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean; inUse: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: itemCategories.id })
        .from(itemCategories)
        .where(and(eq(itemCategories.id, id), eq(itemCategories.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return { notFound: true, inUse: false };

      const [usedItem] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.categoryId, id), eq(items.tenantId, user.tenant_id)))
        .limit(1);
      if (usedItem) return { notFound: false, inUse: true };

      await tx
        .delete(itemCategories)
        .where(and(eq(itemCategories.id, id), eq(itemCategories.tenantId, user.tenant_id)));
      return { notFound: false, inUse: false };
    });
  } catch {
    return { success: false, error: "Failed to delete category." };
  }

  if (result.notFound) return { success: false, error: "Category not found." };
  if (result.inUse) return { success: false, error: "Category is used by existing items." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "item_categories",
      entityId: id,
      action: "category_deleted",
      changes: {},
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/app/inventory/settings");
  return { success: true };
}
