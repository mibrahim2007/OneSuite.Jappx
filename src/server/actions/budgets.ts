"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { budgets, budgetLines } from "@/lib/db/schema";
import { budgetSchema, bulkBudgetLinesSchema } from "@/lib/validations/budgets";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/accounts/budgets";

// ── Create budget ────────────────────────────────────────────────────────────
export async function createBudgetAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData,
) {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:budget:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = budgetSchema.safeParse({
    name: formData.get("name"),
    fiscalYear: formData.get("fiscalYear"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  let result: { id: string };
  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const [row] = await tx
          .insert(budgets)
          .values({ ...parsed.data, tenantId: user.tenant_id, createdBy: user.sub })
          .returning({ id: budgets.id });
        return { id: row!.id };
      }
    );
  } catch {
    return { success: false, error: "Failed to create budget." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, action: "create", entity: "budget", entityId: result.id }); } catch {}
  revalidatePath(REVALIDATE);
  return { success: true };
}

// ── Update budget status (activate / close) ──────────────────────────────────
export async function updateBudgetStatusAction(
  budgetId: string,
  status: "draft" | "active" | "closed",
) {
  if (!UUID_RE.test(budgetId)) return { success: false, error: "Invalid budget ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:budget:update", user);
  if (permError) return { success: false, error: permError.error };

  try {
    await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        await tx
          .update(budgets)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(budgets.id, budgetId), eq(budgets.tenantId, user.tenant_id)));
      }
    );
  } catch {
    return { success: false, error: "Failed to update budget status." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, action: "update", entity: "budget", entityId: budgetId, changes: { status } }); } catch {}
  revalidatePath(REVALIDATE);
  return { success: true };
}

// ── Upsert budget lines (bulk save from grid) ────────────────────────────────
export async function saveBudgetLinesAction(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData,
) {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:budget:update", user);
  if (permError) return { success: false, error: permError.error };

  const raw = formData.get("lines");
  if (!raw || typeof raw !== "string") return { success: false, error: "No lines provided." };

  let parsed: { budgetId: string; lines: { accountId: string; departmentId?: string | null; periodMonth: string; amount: string }[] };
  try {
    const data = bulkBudgetLinesSchema.safeParse(JSON.parse(raw));
    if (!data.success) return { success: false, error: data.error.issues[0]?.message };
    parsed = data.data;
  } catch {
    return { success: false, error: "Invalid lines payload." };
  }

  if (!UUID_RE.test(parsed.budgetId)) return { success: false, error: "Invalid budget ID." };

  try {
    await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        for (const line of parsed.lines) {
          await tx
            .insert(budgetLines)
            .values({
              budgetId: parsed.budgetId,
              tenantId: user.tenant_id,
              accountId: line.accountId,
              departmentId: line.departmentId ?? null,
              periodMonth: line.periodMonth,
              amount: line.amount,
            })
            .onConflictDoUpdate({
              target: [budgetLines.budgetId, budgetLines.accountId, budgetLines.periodMonth],
              set: { amount: line.amount },
            });
        }
      }
    );
  } catch {
    return { success: false, error: "Failed to save budget lines." };
  }

  revalidatePath(`${REVALIDATE}/${parsed.budgetId}`);
  return { success: true };
}
