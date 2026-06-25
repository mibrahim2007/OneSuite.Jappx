"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import {
  bills,
  billLines,
  fiscalPeriods,
  journals,
  journalLines,
  numberSeries,
  taxRates,
} from "@/lib/db/schema";
import { saveBillSchema, type SaveBillValues } from "@/lib/validations/bills";

type Tx = Parameters<Parameters<typeof withTenantRLS>[1]>[0];

const REVALIDATE_PATH = "/app/accounts/bills";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Claim the next bill number atomically — same pattern as nextEntryNo in journal-entries.ts
async function nextBillNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(
      and(
        eq(numberSeries.tenantId, tenantId),
        eq(numberSeries.docType, "bill")
      )
    )
    .returning();

  if (!updated) return `BILL-${String(Date.now()).slice(-8)}`;

  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

// Claim the next journal entry number atomically
async function nextJournalNo(tx: Tx, tenantId: string): Promise<string> {
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

  if (!updated) return `JV-${String(Date.now()).slice(-8)}`;

  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

// Compute tax amounts for each line by reading tax rates from DB inside the tx.
// Returns lines augmented with taxAmount and taxAccountId (for journal construction).
async function computeLineAmounts(
  tx: Tx,
  tenantId: string,
  lines: SaveBillValues["lines"]
): Promise<
  Array<{
    accountId: string;
    description: string | null;
    amount: number;
    taxRateId: string | null;
    taxAmount: number;
    taxAccountId: string | null;
    sortOrder: number;
  }>
> {
  return Promise.all(
    lines.map(async (line, i) => {
      let taxAmt = 0;
      let taxAccountId: string | null = null;

      const rawTaxRateId = line.taxRateId || null;

      if (rawTaxRateId) {
        const [tr] = await tx
          .select({ rate: taxRates.rate, accountId: taxRates.accountId })
          .from(taxRates)
          .where(
            and(eq(taxRates.id, rawTaxRateId), eq(taxRates.tenantId, tenantId))
          )
          .limit(1);

        if (tr) {
          taxAmt = line.amount * (parseFloat(tr.rate) / 100);
          taxAccountId = tr.accountId ?? null;
        }
      }

      return {
        accountId: line.accountId,
        description: line.description?.trim() || null,
        amount: line.amount,
        taxRateId: rawTaxRateId,
        taxAmount: taxAmt,
        taxAccountId,
        sortOrder: i,
      };
    })
  );
}

// ─── Create Draft Bill ────────────────────────────────────────────────────────

export async function createBillAction(
  data: SaveBillValues
): Promise<{ success: boolean; error?: string; billId?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:bill:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = saveBillSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const {
    vendorId,
    billDate,
    dueDate,
    periodId,
    payableAccountId,
    lines,
  } = parsed.data;

  const reference = parsed.data.reference?.trim() || null;
  const notes = parsed.data.notes?.trim() || null;

  let result: { ok: true; billId: string; billNo: string } | { ok: false; error: string };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const computedLines = await computeLineAmounts(tx, user.tenant_id, lines);

        const subtotal = lines.reduce((s, l) => s + l.amount, 0);
        const taxTotal = computedLines.reduce((s, l) => s + l.taxAmount, 0);
        const total = subtotal + taxTotal;

        const billNo = await nextBillNo(tx, user.tenant_id);

        const [inserted] = await tx
          .insert(bills)
          .values({
            tenantId: user.tenant_id,
            vendorId,
            billNo,
            billDate,
            dueDate,
            periodId: periodId || null,
            reference,
            notes,
            status: "draft",
            subtotal: String(subtotal),
            taxAmount: String(taxTotal),
            total: String(total),
            payableAccountId,
            createdBy: user.sub,
          })
          .returning({ id: bills.id, billNo: bills.billNo });

        if (!inserted) return { ok: false as const, error: "Failed to create bill." };

        await tx.insert(billLines).values(
          computedLines.map((l) => ({
            tenantId: user.tenant_id,
            billId: inserted.id,
            sortOrder: l.sortOrder,
            accountId: l.accountId,
            description: l.description,
            amount: String(l.amount),
            taxRateId: l.taxRateId,
            taxAmount: String(l.taxAmount),
          }))
        );

        return { ok: true as const, billId: inserted.id, billNo: inserted.billNo };
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error.";
    return { success: false, error: msg };
  }

  if (!result.ok) return { success: false, error: result.error };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "bills",
      entityId: result.billId,
      action: "bill_created",
      changes: { billNo: result.billNo, vendorId, billDate, total: parsed.data },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true, billId: result.billId };
}

// ─── Update Draft Bill ────────────────────────────────────────────────────────

export async function updateBillAction(
  id: string,
  data: SaveBillValues
): Promise<{
  success: boolean;
  error?: string;
  notFound?: boolean;
  notDraft?: boolean;
}> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid bill ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:bill:update", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = saveBillSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const {
    vendorId,
    billDate,
    dueDate,
    periodId,
    payableAccountId,
    lines,
  } = parsed.data;

  const reference = parsed.data.reference?.trim() || null;
  const notes = parsed.data.notes?.trim() || null;

  let result:
    | { ok: true; billId: string }
    | { ok: false; error: string; notFound?: boolean; notDraft?: boolean };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const [existing] = await tx
          .select({ id: bills.id, status: bills.status })
          .from(bills)
          .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)))
          .limit(1);

        if (!existing) return { ok: false as const, error: "Bill not found.", notFound: true };
        if (existing.status !== "draft") {
          return { ok: false as const, error: "Only draft bills can be edited.", notDraft: true };
        }

        const computedLines = await computeLineAmounts(tx, user.tenant_id, lines);
        const subtotal = lines.reduce((s, l) => s + l.amount, 0);
        const taxTotal = computedLines.reduce((s, l) => s + l.taxAmount, 0);
        const total = subtotal + taxTotal;

        await tx
          .update(bills)
          .set({
            vendorId,
            billDate,
            dueDate,
            periodId: periodId || null,
            reference,
            notes,
            subtotal: String(subtotal),
            taxAmount: String(taxTotal),
            total: String(total),
            payableAccountId,
            updatedAt: new Date(),
          })
          .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)));

        // Replace all lines: delete old, insert new
        await tx
          .delete(billLines)
          .where(and(eq(billLines.billId, id), eq(billLines.tenantId, user.tenant_id)));

        await tx.insert(billLines).values(
          computedLines.map((l) => ({
            tenantId: user.tenant_id,
            billId: id,
            sortOrder: l.sortOrder,
            accountId: l.accountId,
            description: l.description,
            amount: String(l.amount),
            taxRateId: l.taxRateId,
            taxAmount: String(l.taxAmount),
          }))
        );

        return { ok: true as const, billId: id };
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error.";
    return { success: false, error: msg };
  }

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      notFound: result.notFound,
      notDraft: result.notDraft,
    };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "bills",
      entityId: result.billId,
      action: "bill_updated",
      changes: { vendorId, billDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// ─── Post Bill → Journal Entry ────────────────────────────────────────────────

export async function postBillAction(id: string): Promise<{
  success: boolean;
  error?: string;
  notFound?: boolean;
  notDraft?: boolean;
}> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid bill ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:bill:post", user);
  if (permError) return { success: false, error: permError.error };

  let result:
    | { ok: true; billId: string; billNo: string; journalId: string }
    | { ok: false; error: string; notFound?: boolean; notDraft?: boolean };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        // Fetch bill
        const [bill] = await tx
          .select()
          .from(bills)
          .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)))
          .limit(1);

        if (!bill) return { ok: false as const, error: "Bill not found.", notFound: true };
        if (bill.status !== "draft") {
          return { ok: false as const, error: "Only draft bills can be posted.", notDraft: true };
        }

        // Verify period is open
        if (bill.periodId) {
          const [period] = await tx
            .select({ status: fiscalPeriods.status, name: fiscalPeriods.name })
            .from(fiscalPeriods)
            .where(eq(fiscalPeriods.id, bill.periodId))
            .limit(1);

          if (!period || period.status !== "open") {
            const msg = !period
              ? "Fiscal period not found — posting not allowed."
              : `Period ${period.name} is closed — posting not allowed.`;
            return { ok: false as const, error: msg };
          }
        }

        // Fetch bill lines with their tax rate account IDs
        const lines = await tx
          .select({
            id: billLines.id,
            accountId: billLines.accountId,
            amount: billLines.amount,
            taxRateId: billLines.taxRateId,
            taxAmount: billLines.taxAmount,
            description: billLines.description,
          })
          .from(billLines)
          .where(and(eq(billLines.billId, id), eq(billLines.tenantId, user.tenant_id)));

        if (lines.length === 0) {
          return { ok: false as const, error: "Bill has no lines to post." };
        }

        // Resolve tax account IDs for each line that has a tax rate
        const taxRateIds = [...new Set(lines.map((l) => l.taxRateId).filter(Boolean) as string[])];
        const taxRateMap = new Map<string, string | null>();

        if (taxRateIds.length > 0) {
          const rows = await tx
            .select({ id: taxRates.id, accountId: taxRates.accountId })
            .from(taxRates)
            .where(and(inArray(taxRates.id, taxRateIds), eq(taxRates.tenantId, user.tenant_id)));
          for (const row of rows) {
            taxRateMap.set(row.id, row.accountId ?? null);
          }
        }

        // Build journal lines (DR expense/tax, CR payable)
        type JournalLineInput = {
          tenantId: string;
          journalId: string;
          accountId: string;
          debit: string;
          credit: string;
          description: string | null;
          costCenterId: null;
        };

        const jLines: Omit<JournalLineInput, "journalId">[] = [];

        for (const line of lines) {
          const lineAmount = parseFloat(line.amount);
          const lineTaxAmount = parseFloat(line.taxAmount);
          const taxAccId = line.taxRateId ? taxRateMap.get(line.taxRateId) ?? null : null;

          if (taxAccId && lineTaxAmount > 0) {
            // Recoverable tax: separate DR for expense and tax account
            jLines.push({
              tenantId: user.tenant_id,
              accountId: line.accountId,
              debit: String(lineAmount),
              credit: "0",
              description: line.description,
              costCenterId: null,
            });
            jLines.push({
              tenantId: user.tenant_id,
              accountId: taxAccId,
              debit: String(lineTaxAmount),
              credit: "0",
              description: `Tax on: ${line.description ?? bill.billNo}`,
              costCenterId: null,
            });
          } else {
            // Non-recoverable tax: fold into expense debit
            jLines.push({
              tenantId: user.tenant_id,
              accountId: line.accountId,
              debit: String(lineAmount + lineTaxAmount),
              credit: "0",
              description: line.description,
              costCenterId: null,
            });
          }
        }

        // CR payable account for bill total
        const billTotal = parseFloat(bill.total);
        jLines.push({
          tenantId: user.tenant_id,
          accountId: bill.payableAccountId,
          debit: "0",
          credit: String(billTotal),
          description: `AP: ${bill.billNo}`,
          costCenterId: null,
        });

        // Verify journal balances (guard against floating point drift)
        const totalDebits = jLines.reduce((s, l) => s + parseFloat(l.debit), 0);
        const totalCredits = jLines.reduce((s, l) => s + parseFloat(l.credit), 0);
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          return {
            ok: false as const,
            error: `Journal unbalanced: debits ${totalDebits.toFixed(2)} ≠ credits ${totalCredits.toFixed(2)}`,
          };
        }

        const entryNo = await nextJournalNo(tx, user.tenant_id);

        const [inserted] = await tx
          .insert(journals)
          .values({
            tenantId: user.tenant_id,
            entryNo,
            entryDate: bill.billDate,
            periodId: bill.periodId,
            source: "bill",
            reference: bill.billNo,
            memo: bill.reference ? `Vendor bill: ${bill.reference}` : null,
            isPosted: true,
            createdBy: user.sub,
          })
          .returning({ id: journals.id });

        if (!inserted) return { ok: false as const, error: "Failed to create journal entry." };

        await tx.insert(journalLines).values(
          jLines.map((l) => ({ ...l, journalId: inserted.id }))
        );

        // Mark bill as posted and link journal
        await tx
          .update(bills)
          .set({ status: "posted", journalId: inserted.id, updatedAt: new Date() })
          .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)));

        return { ok: true as const, billId: id, billNo: bill.billNo, journalId: inserted.id };
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error.";
    return { success: false, error: msg };
  }

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      notFound: result.notFound,
      notDraft: result.notDraft,
    };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "bills",
      entityId: result.billId,
      action: "bill_posted",
      changes: { billNo: result.billNo, journalId: result.journalId },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// ─── Delete Draft Bill ────────────────────────────────────────────────────────

export async function deleteBillAction(id: string): Promise<{
  success: boolean;
  error?: string;
  notFound?: boolean;
  notDraft?: boolean;
}> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid bill ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:bill:delete", user);
  if (permError) return { success: false, error: permError.error };

  let result:
    | { ok: true; billId: string; billNo: string }
    | { ok: false; error: string; notFound?: boolean; notDraft?: boolean };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const [existing] = await tx
          .select({ id: bills.id, status: bills.status, billNo: bills.billNo })
          .from(bills)
          .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)))
          .limit(1);

        if (!existing) return { ok: false as const, error: "Bill not found.", notFound: true };
        if (existing.status !== "draft") {
          return {
            ok: false as const,
            error: "Only draft bills can be deleted.",
            notDraft: true,
          };
        }

        // CASCADE on bill_lines handles lines automatically
        await tx
          .delete(bills)
          .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)));

        return { ok: true as const, billId: id, billNo: existing.billNo };
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error.";
    return { success: false, error: msg };
  }

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      notFound: result.notFound,
      notDraft: result.notDraft,
    };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "bills",
      entityId: result.billId,
      action: "bill_deleted",
      changes: { billNo: result.billNo },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
