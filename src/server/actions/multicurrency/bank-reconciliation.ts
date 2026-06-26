"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { bankStatements, bankStatementLines } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";
import { bankStatementSchema, bankStatementLineSchema } from "@/lib/validations/multicurrency";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionResult = { success: boolean; error?: string; id?: string };

export async function createBankStatementAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("accounts:journal:create", user);
  if (perm) return { success: false, error: perm.error };

  const parsed = bankStatementSchema.safeParse({
    accountId: formData.get("accountId"),
    statementDate: formData.get("statementDate"),
    openingBalance: formData.get("openingBalance"),
    closingBalance: formData.get("closingBalance"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  let id: string | undefined;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [row] = await tx.insert(bankStatements).values({
        tenantId: user.tenant_id,
        ...parsed.data,
      }).returning({ id: bankStatements.id });
      id = row?.id;
    });
  } catch {
    return { success: false, error: "Failed to create bank statement." };
  }

  revalidatePath("/app/accounts/bank-reconciliation");
  return { success: true, id };
}

export async function addStatementLineAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("accounts:journal:create", user);
  if (perm) return { success: false, error: perm.error };

  const parsed = bankStatementLineSchema.safeParse({
    statementId: formData.get("statementId"),
    lineDate: formData.get("lineDate"),
    description: formData.get("description"),
    debit: formData.get("debit") ?? "0",
    credit: formData.get("credit") ?? "0",
    reference: formData.get("reference"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(bankStatementLines).values({
        tenantId: user.tenant_id,
        ...parsed.data,
      });
    });
  } catch {
    return { success: false, error: "Failed to add statement line." };
  }

  revalidatePath("/app/accounts/bank-reconciliation");
  return { success: true };
}

export async function matchStatementLineAction(
  lineId: string,
  journalLineId: string | null
): Promise<ActionResult> {
  if (!UUID_RE.test(lineId)) return { success: false, error: "Invalid line ID." };
  if (journalLineId && !UUID_RE.test(journalLineId)) return { success: false, error: "Invalid journal line ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("accounts:journal:create", user);
  if (perm) return { success: false, error: perm.error };

  let errorMsg: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      // If matching (not clearing), guard against the same journal line being double-matched
      if (journalLineId) {
        const [alreadyUsed] = await tx
          .select({ id: bankStatementLines.id })
          .from(bankStatementLines)
          .where(
            and(
              eq(bankStatementLines.tenantId, user.tenant_id),
              eq(bankStatementLines.matchedJournalLineId, journalLineId),
              ne(bankStatementLines.id, lineId)
            )
          )
          .limit(1);
        if (alreadyUsed) {
          errorMsg = "This journal line is already matched to another statement line.";
          return;
        }
      }

      await tx
        .update(bankStatementLines)
        .set({ matchedJournalLineId: journalLineId })
        .where(and(eq(bankStatementLines.id, lineId), eq(bankStatementLines.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to match line." };
  }
  if (errorMsg) return { success: false, error: errorMsg };

  revalidatePath("/app/accounts/bank-reconciliation");
  return { success: true };
}

export async function finaliseReconciliationAction(statementId: string): Promise<ActionResult> {
  if (!UUID_RE.test(statementId)) return { success: false, error: "Invalid ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("accounts:journal:post", user);
  if (perm) return { success: false, error: perm.error };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(bankStatements)
        .set({ isReconciled: true })
        .where(and(eq(bankStatements.id, statementId), eq(bankStatements.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to finalise reconciliation." };
  }

  try { await createAuditLog({ action: "post", entity: "bank_statement", entityId: statementId, userId: user.sub, tenantId: user.tenant_id }); } catch {}
  revalidatePath("/app/accounts/bank-reconciliation");
  return { success: true };
}
