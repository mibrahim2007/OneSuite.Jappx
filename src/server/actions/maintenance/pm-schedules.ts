"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { pmSchedules } from "@/lib/db/schema";
import { pmScheduleSchema } from "@/lib/validations/maintenance";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/maintenance/pm-schedules";

type ActionState = { success: true } | { success: false; error: string } | null;

export async function createPmScheduleAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:pm:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = pmScheduleSchema.safeParse({
    assetId: formData.get("assetId"),
    name: (formData.get("name") as string)?.trim(),
    basis: formData.get("basis") || "time",
    intervalDays: (formData.get("intervalDays") as string) ? Number(formData.get("intervalDays")) : null,
    intervalMeter: (formData.get("intervalMeter") as string) || null,
    nextDueDate: (formData.get("nextDueDate") as string) || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { assetId, name, basis, intervalDays, intervalMeter, nextDueDate } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let schedId: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx.insert(pmSchedules).values({
        tenantId: user.tenant_id,
        assetId,
        name,
        basis: basis as "time" | "meter",
        intervalDays: intervalDays ?? null,
        intervalMeter: intervalMeter ?? null,
        nextDueDate: nextDueDate ?? null,
      }).returning({ id: pmSchedules.id });
      schedId = inserted!.id;
    });
  } catch {
    return { success: false, error: "Failed to create PM schedule." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "pm_schedules", entityId: schedId, action: "pm_created", changes: { name } });
  } catch { /* non-fatal */ }

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updatePmScheduleAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:pm:update", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid PM schedule ID." };

  const parsed = pmScheduleSchema.safeParse({
    assetId: formData.get("assetId"),
    name: (formData.get("name") as string)?.trim(),
    basis: formData.get("basis") || "time",
    intervalDays: (formData.get("intervalDays") as string) ? Number(formData.get("intervalDays")) : null,
    intervalMeter: (formData.get("intervalMeter") as string) || null,
    nextDueDate: (formData.get("nextDueDate") as string) || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { assetId, name, basis, intervalDays, intervalMeter, nextDueDate } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: pmSchedules.id }).from(pmSchedules)
        .where(and(eq(pmSchedules.id, id), eq(pmSchedules.tenantId, user.tenant_id))).limit(1);
      if (!existing) { notFound = true; return; }
      await tx.update(pmSchedules).set({
        assetId, name, basis: basis as "time" | "meter",
        intervalDays: intervalDays ?? null, intervalMeter: intervalMeter ?? null,
        nextDueDate: nextDueDate ?? null,
      }).where(and(eq(pmSchedules.id, id), eq(pmSchedules.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update PM schedule." };
  }

  if (notFound) return { success: false, error: "PM schedule not found." };

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function togglePmScheduleAction(
  scheduleId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(scheduleId)) return { success: false, error: "Invalid schedule ID." };

  const permError = requirePermission("rm:pm:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(pmSchedules).set({ isActive })
        .where(and(eq(pmSchedules.id, scheduleId), eq(pmSchedules.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update PM schedule." };
  }

  revalidatePath(REVALIDATE);
  return { success: true };
}
