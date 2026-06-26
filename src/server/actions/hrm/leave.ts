"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { leaveTypes, leaveRequests } from "@/lib/db/schema";
import { leaveTypeSchema, leaveRequestSchema } from "@/lib/validations/hrm";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

// --- Leave Types ---

export async function createLeaveTypeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:leave:approve", user);
  if (permError) return permError;

  const parsed = leaveTypeSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    annualQuota: (formData.get("annualQuota") as string) || "0",
    isPaid: formData.get("isPaid") === "true",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(leaveTypes).values({
        tenantId: user.tenant_id,
        name: parsed.data.name,
        annualQuota: parsed.data.annualQuota,
        isPaid: parsed.data.isPaid,
      });
    });
  } catch {
    return { success: false, error: "Failed to create leave type." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leave_type", action: "create" }); } catch {}
  revalidatePath("/app/hrm/leave");
  return { success: true };
}

export async function updateLeaveTypeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:leave:approve", user);
  if (permError) return permError;

  const id = formData.get("id") as string;
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid leave type ID." };

  const parsed = leaveTypeSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    annualQuota: (formData.get("annualQuota") as string) || "0",
    isPaid: formData.get("isPaid") === "true",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(leaveTypes)
        .set({ name: parsed.data.name, annualQuota: parsed.data.annualQuota, isPaid: parsed.data.isPaid })
        .where(and(eq(leaveTypes.id, id), eq(leaveTypes.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update leave type." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leave_type", entityId: id, action: "update" }); } catch {}
  revalidatePath("/app/hrm/leave");
  return { success: true };
}

// --- Leave Requests ---

export async function createLeaveRequestAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:leave:request", user);
  if (permError) return permError;

  const parsed = leaveRequestSchema.safeParse({
    employeeId: formData.get("employeeId") as string,
    leaveTypeId: (formData.get("leaveTypeId") as string) || null,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
    days: formData.get("days") as string,
    reason: (formData.get("reason") as string)?.trim() || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(leaveRequests).values({
        tenantId: user.tenant_id,
        employeeId: parsed.data.employeeId,
        leaveTypeId: parsed.data.leaveTypeId ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        days: parsed.data.days,
        reason: parsed.data.reason ?? null,
        status: "pending",
      });
    });
  } catch {
    return { success: false, error: "Failed to submit leave request." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leave_request", action: "create" }); } catch {}
  revalidatePath("/app/hrm/leave");
  return { success: true };
}

export async function decideLeaveRequestAction(
  requestId: string,
  decision: "approved" | "rejected"
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:leave:approve", user);
  if (permError) return permError;
  if (!UUID_RE.test(requestId)) return { success: false, error: "Invalid request ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(leaveRequests)
        .set({ status: decision, approvedBy: user.sub })
        .where(and(
          eq(leaveRequests.id, requestId),
          eq(leaveRequests.tenantId, user.tenant_id),
          eq(leaveRequests.status, "pending")
        ));
    });
  } catch {
    return { success: false, error: "Failed to update leave request." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leave_request", entityId: requestId, action: decision }); } catch {}
  revalidatePath("/app/hrm/leave");
  return { success: true };
}

export async function cancelLeaveRequestAction(requestId: string): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:leave:request", user);
  if (permError) return permError;
  if (!UUID_RE.test(requestId)) return { success: false, error: "Invalid request ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(leaveRequests)
        .set({ status: "cancelled" })
        .where(and(
          eq(leaveRequests.id, requestId),
          eq(leaveRequests.tenantId, user.tenant_id),
          eq(leaveRequests.status, "pending")
        ));
    });
  } catch {
    return { success: false, error: "Failed to cancel leave request." };
  }

  revalidatePath("/app/hrm/leave");
  return { success: true };
}
