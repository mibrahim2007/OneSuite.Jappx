"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { appraisalCycles, appraisals, appraisalKpis, employees } from "@/lib/db/schema";
import { appraisalCycleSchema, appraisalKpiSchema } from "@/lib/validations/hrm";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type AS = { success: true } | { success: false; error: string } | null;

// --- Cycles ---

export async function createAppraisalCycleAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:appraisal:manage", user);
  if (err) return err;

  const parsed = appraisalCycleSchema.safeParse({
    name: (fd.get("name") as string)?.trim(),
    periodStart: fd.get("periodStart") as string,
    periodEnd: fd.get("periodEnd") as string,
    status: (fd.get("status") as string) || "draft",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(appraisalCycles).values({ tenantId: user.tenant_id, ...parsed.data });
    });
  } catch { return { success: false, error: "Failed to create appraisal cycle." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "appraisal_cycle", action: "create" }); } catch {}
  revalidatePath("/app/hrm/appraisals");
  return { success: true };
}

export async function updateCycleStatusAction(cycleId: string, status: "draft" | "active" | "closed"): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:appraisal:manage", user);
  if (err) return err;
  if (!UUID_RE.test(cycleId)) return { success: false, error: "Invalid cycle ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(appraisalCycles).set({ status })
        .where(and(eq(appraisalCycles.id, cycleId), eq(appraisalCycles.tenantId, user.tenant_id)));
    });
  } catch { return { success: false, error: "Failed to update cycle." }; }

  revalidatePath("/app/hrm/appraisals");
  return { success: true };
}

// --- Generate appraisals for all active employees in a cycle ---

export async function generateAppraisalsAction(cycleId: string): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:appraisal:manage", user);
  if (err) return err;
  if (!UUID_RE.test(cycleId)) return { success: false, error: "Invalid cycle ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      const empRows = await tx.select({ id: employees.id, managerId: employees.managerId })
        .from(employees)
        .where(and(eq(employees.tenantId, user.tenant_id), eq(employees.status, "active")));

      const existing = await tx.select({ employeeId: appraisals.employeeId })
        .from(appraisals)
        .where(and(eq(appraisals.cycleId, cycleId), eq(appraisals.tenantId, user.tenant_id)));

      const existingIds = new Set(existing.map((e) => e.employeeId));
      const toInsert = empRows
        .filter((e) => !existingIds.has(e.id))
        .map((e) => ({
          tenantId: user.tenant_id,
          cycleId,
          employeeId: e.id,
          reviewerId: e.managerId ?? null,
          status: "pending" as const,
        }));

      if (toInsert.length > 0) {
        await tx.insert(appraisals).values(toInsert);
      }
    });
  } catch { return { success: false, error: "Failed to generate appraisals." }; }

  revalidatePath(`/app/hrm/appraisals/${cycleId}`);
  return { success: true };
}

// --- KPI submission (self-review) ---

export async function saveKpisAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:appraisal:self", user);
  if (err) return err;

  const appraisalId = fd.get("appraisalId") as string;
  if (!UUID_RE.test(appraisalId)) return { success: false, error: "Invalid appraisal ID." };

  // Parse KPI lines from JSON encoded field
  let kpis: unknown[];
  try { kpis = JSON.parse(fd.get("kpis") as string) as unknown[]; }
  catch { return { success: false, error: "Invalid KPI data." }; }

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      // Delete existing KPIs for this appraisal
      await tx.delete(appraisalKpis).where(eq(appraisalKpis.appraisalId, appraisalId));

      // Validate and insert new ones
      for (const k of kpis) {
        const parsed = appraisalKpiSchema.safeParse(k);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid KPI.");
        await tx.insert(appraisalKpis).values({ appraisalId, ...parsed.data });
      }

      // Advance status to self_review
      await tx.update(appraisals).set({ status: "self_review", updatedAt: new Date() })
        .where(and(eq(appraisals.id, appraisalId), eq(appraisals.tenantId, user.tenant_id)));
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save KPIs." };
  }

  revalidatePath("/app/hrm/appraisals");
  return { success: true };
}

// --- Manager review (set overall rating + advance) ---

export async function submitManagerReviewAction(
  appraisalId: string,
  overallRating: string,
  comments: string
): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:appraisal:manage", user);
  if (err) return err;
  if (!UUID_RE.test(appraisalId)) return { success: false, error: "Invalid appraisal ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(appraisals).set({
        overallRating,
        comments,
        status: "completed",
        updatedAt: new Date(),
      }).where(and(eq(appraisals.id, appraisalId), eq(appraisals.tenantId, user.tenant_id)));
    });
  } catch { return { success: false, error: "Failed to submit review." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "appraisal", entityId: appraisalId, action: "completed" }); } catch {}
  revalidatePath("/app/hrm/appraisals");
  return { success: true };
}
