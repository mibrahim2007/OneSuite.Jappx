"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import {
  accounts,
  journals,
  journalLines,
  fiscalPeriods,
  numberSeries,
  type Journal,
  type JournalLine,
} from "@/lib/db/schema";
import {
  postJournalSchema,
  type PostJournalValues,
} from "@/lib/validations/journal-entry";

type Tx = Parameters<Parameters<typeof withTenantRLS>[1]>[0];

const REVALIDATE_PATH = "/app/accounts/journal-entries";

// Atomically claim the next sequence number via UPDATE RETURNING to prevent
// two concurrent requests from reading the same value before either commits.
async function nextEntryNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(
      and(
        eq(numberSeries.tenantId, tenantId),
        eq(numberSeries.docType, "journal")
      )
    )
    .returning();

  if (!updated) {
    return `JV-${String(Date.now()).slice(-8)}`;
  }

  // .returning() gives the AFTER value; subtract 1 to get the number we claimed
  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

export async function postJournalAction(
  data: PostJournalValues
): Promise<{ success: boolean; error?: string; journalNo?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:journal:post", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = postJournalSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { entryDate, periodId, reference, memo, lines } = parsed.data;

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return {
      success: false,
      error: `Journal is unbalanced — debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`,
    };
  }

  const ctx = {
    tenantId: user.tenant_id,
    userId: user.sub,
    permissions: user.permissions,
  };

  const result = await withTenantRLS(ctx, async (tx) => {
    const [period] = await tx
      .select({ id: fiscalPeriods.id, status: fiscalPeriods.status, name: fiscalPeriods.name })
      .from(fiscalPeriods)
      .where(
        and(
          eq(fiscalPeriods.id, periodId),
          eq(fiscalPeriods.tenantId, user.tenant_id)
        )
      )
      .limit(1);

    if (!period) return { ok: false as const, error: "Fiscal period not found." };
    if (period.status !== "open") {
      return {
        ok: false as const,
        error: `Period ${period.name} is closed — posting not allowed.`,
      };
    }

    const entryNo = await nextEntryNo(tx, user.tenant_id);

    const [inserted] = await tx
      .insert(journals)
      .values({
        tenantId: user.tenant_id,
        entryNo,
        entryDate,
        periodId,
        source: "manual",
        reference: reference || null,
        memo: memo || null,
        isPosted: true,
        createdBy: user.sub,
      })
      .returning({ id: journals.id, entryNo: journals.entryNo });

    if (!inserted) {
      return { ok: false as const, error: "Failed to create journal entry." };
    }

    await tx.insert(journalLines).values(
      lines.map((l) => ({
        tenantId: user.tenant_id,
        journalId: inserted.id,
        accountId: l.accountId,
        debit: String(l.debit),
        credit: String(l.credit),
        description: l.description || null,
        costCenterId: null,
      }))
    );

    return {
      ok: true as const,
      journalId: inserted.id,
      entryNo: inserted.entryNo,
    };
  });

  if (!result.ok) return { success: false, error: result.error };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "journals",
      entityId: result.journalId,
      action: "journal_posted",
      changes: {
        entryNo: result.entryNo,
        entryDate,
        periodId,
        lineCount: lines.length,
        totalDebit,
        totalCredit,
      },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true, journalNo: result.entryNo };
}

export async function voidJournalAction(
  journalId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:journal:void", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = {
    tenantId: user.tenant_id,
    userId: user.sub,
    permissions: user.permissions,
  };

  const result = await withTenantRLS(ctx, async (tx) => {
    const [original] = await tx
      .select()
      .from(journals)
      .where(
        and(
          eq(journals.id, journalId),
          eq(journals.tenantId, user.tenant_id)
        )
      )
      .limit(1);

    if (!original) return { ok: false as const, error: "Journal not found." };
    // isPosted=false means already voided; isPosted is the void state marker
    if (!original.isPosted)
      return { ok: false as const, error: "Only posted journals can be voided." };
    // Reversal entries carry "VOID: " prefix — voiding them would create infinite chains
    if (original.reference?.startsWith("VOID: "))
      return { ok: false as const, error: "Reversal entries cannot be voided." };

    if (original.periodId) {
      const [period] = await tx
        .select({ status: fiscalPeriods.status, name: fiscalPeriods.name })
        .from(fiscalPeriods)
        .where(eq(fiscalPeriods.id, original.periodId))
        .limit(1);
      if (period && period.status !== "open") {
        return {
          ok: false as const,
          error: `Period ${period.name} is closed — cannot void entries in this period.`,
        };
      }
    }

    const originalLines = await tx
      .select()
      .from(journalLines)
      .where(
        and(
          eq(journalLines.journalId, journalId),
          eq(journalLines.tenantId, user.tenant_id)
        )
      );

    if (originalLines.length === 0) {
      return { ok: false as const, error: "Journal has no lines to reverse." };
    }

    const reversalEntryNo = await nextEntryNo(tx, user.tenant_id);

    // Atomically flip isPosted=false before inserting the reversal so that if a
    // second concurrent void request wins the lock race, it gets 0 rows back and
    // returns an error rather than creating a second reversal journal.
    const [voidedOriginal] = await tx
      .update(journals)
      .set({ isPosted: false, updatedAt: new Date() })
      .where(
        and(
          eq(journals.id, journalId),
          eq(journals.tenantId, user.tenant_id),
          eq(journals.isPosted, true)
        )
      )
      .returning({ id: journals.id });

    if (!voidedOriginal) {
      return {
        ok: false as const,
        error: "Journal could not be voided — it may have been voided by another session.",
      };
    }

    const [reversal] = await tx
      .insert(journals)
      .values({
        tenantId: user.tenant_id,
        entryNo: reversalEntryNo,
        entryDate: original.entryDate,
        periodId: original.periodId,
        source: "manual",
        reference: `VOID: ${original.entryNo}`,
        memo: `Reversal of ${original.entryNo}`,
        isPosted: true,
        createdBy: user.sub,
      })
      .returning({ id: journals.id });

    if (!reversal) {
      return { ok: false as const, error: "Failed to create reversal entry." };
    }

    await tx.insert(journalLines).values(
      originalLines.map((l) => ({
        tenantId: user.tenant_id,
        journalId: reversal.id,
        accountId: l.accountId,
        debit: l.credit,
        credit: l.debit,
        description: l.description,
        costCenterId: null,
      }))
    );

    return { ok: true as const, reversalEntryNo };
  });

  if (!result.ok) return { success: false, error: result.error };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "journals",
      entityId: journalId,
      action: "journal_voided",
      changes: { reversalEntryNo: result.reversalEntryNo },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function getJournalDetailAction(journalId: string): Promise<{
  success: boolean;
  error?: string;
  journal?: Journal;
  lines?: Array<JournalLine & { accountCode: string; accountName: string }>;
}> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:journal:view", user);
  if (permError) return { success: false, error: permError.error };

  const [journal] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, journalId), eq(journals.tenantId, user.tenant_id)))
    .limit(1);

  if (!journal) return { success: false, error: "Journal not found." };

  const lines = await db
    .select({
      id: journalLines.id,
      tenantId: journalLines.tenantId,
      journalId: journalLines.journalId,
      accountId: journalLines.accountId,
      costCenterId: journalLines.costCenterId,
      debit: journalLines.debit,
      credit: journalLines.credit,
      description: journalLines.description,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(journalLines.journalId, journalId),
        eq(journalLines.tenantId, user.tenant_id),
        eq(accounts.tenantId, user.tenant_id),
      )
    );

  return { success: true, journal, lines };
}
