"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { departments, designations } from "@/lib/db/schema";
import { departmentSchema, designationSchema } from "@/lib/validations/hrm";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

// --- Departments ---

export async function createDepartmentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:employee:create", user);
  if (permError) return permError;

  const parsed = departmentSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    parentId: (formData.get("parentId") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(departments).values({
        tenantId: user.tenant_id,
        name: parsed.data.name,
        parentId: parsed.data.parentId ?? null,
      });
    });
  } catch {
    return { success: false, error: "Failed to create department." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "department", action: "create" }); } catch {}
  revalidatePath("/app/hrm/departments");
  return { success: true };
}

export async function updateDepartmentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:employee:update", user);
  if (permError) return permError;

  const id = formData.get("id") as string;
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid department ID." };

  const parsed = departmentSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    parentId: (formData.get("parentId") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(departments)
        .set({ name: parsed.data.name, parentId: parsed.data.parentId ?? null })
        .where(and(eq(departments.id, id), eq(departments.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update department." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "department", entityId: id, action: "update" }); } catch {}
  revalidatePath("/app/hrm/departments");
  return { success: true };
}

// --- Designations ---

export async function createDesignationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:employee:create", user);
  if (permError) return permError;

  const parsed = designationSchema.safeParse({ title: (formData.get("title") as string)?.trim() });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(designations).values({ tenantId: user.tenant_id, title: parsed.data.title });
    });
  } catch {
    return { success: false, error: "Failed to create designation." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "designation", action: "create" }); } catch {}
  revalidatePath("/app/hrm/departments");
  return { success: true };
}

export async function updateDesignationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:employee:update", user);
  if (permError) return permError;

  const id = formData.get("id") as string;
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid designation ID." };

  const parsed = designationSchema.safeParse({ title: (formData.get("title") as string)?.trim() });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(designations)
        .set({ title: parsed.data.title })
        .where(and(eq(designations.id, id), eq(designations.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update designation." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "designation", entityId: id, action: "update" }); } catch {}
  revalidatePath("/app/hrm/departments");
  return { success: true };
}
