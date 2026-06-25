"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import {
  invoices,
  invoiceLines,
  fiscalPeriods,
  journals,
  journalLines,
  numberSeries,
  taxRates,
} from "@/lib/db/schema";
import { saveInvoiceSchema, type SaveInvoiceValues } from "@/lib/validations/invoices";

type Tx = Parameters<Parameters<typeof withTenantRLS>[1]>[0];

const REVALIDATE_PATH = "/app/accounts/invoices";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function nextInvoiceNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(
      and(
        eq(numberSeries.tenantId, tenantId),
        eq(numberSeries.docType, "invoice")
      )
    )
    .returning();

  if (!updated) return `INV-${String(Date.now()).slice(-8)}`;

  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

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

async function computeLineAmounts(
  tx: Tx,
  tenantId: string,
  lines: SaveInvoiceValues["lines"]
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

// ─── Create Draft Invoice ─────────────────────────────────────────────────────

export async function createInvoiceAction(
  data: SaveInvoiceValues
): Promise<{ success: boolean; error?: string; invoiceId?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:invoice:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = saveInvoiceSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const {
    customerId,
    invoiceDate,
    dueDate,
    periodId,
    receivableAccountId,
    lines,
  } = parsed.data;

  const reference = parsed.data.reference?.trim() || null;
  const notes = parsed.data.notes?.trim() || null;

  let result: { ok: true; invoiceId: string; invoiceNo: string } | { ok: false; error: string };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const computedLines = await computeLineAmounts(tx, user.tenant_id, lines);

        const subtotal = lines.reduce((s, l) => s + l.amount, 0);
        const taxTotal = computedLines.reduce((s, l) => s + l.taxAmount, 0);
        const total = subtotal + taxTotal;

        const invoiceNo = await nextInvoiceNo(tx, user.tenant_id);

        const [inserted] = await tx
          .insert(invoices)
          .values({
            tenantId: user.tenant_id,
            customerId,
            invoiceNo,
            invoiceDate,
            dueDate,
            periodId: periodId || null,
            reference,
            notes,
            status: "draft",
            subtotal: String(subtotal),
            taxAmount: String(taxTotal),
            total: String(total),
            receivableAccountId,
            createdBy: user.sub,
          })
          .returning({ id: invoices.id, invoiceNo: invoices.invoiceNo });

        if (!inserted) return { ok: false as const, error: "Failed to create invoice." };

        await tx.insert(invoiceLines).values(
          computedLines.map((l) => ({
            tenantId: user.tenant_id,
            invoiceId: inserted.id,
            sortOrder: l.sortOrder,
            accountId: l.accountId,
            description: l.description,
            amount: String(l.amount),
            taxRateId: l.taxRateId,
            taxAmount: String(l.taxAmount),
          }))
        );

        return { ok: true as const, invoiceId: inserted.id, invoiceNo: inserted.invoiceNo };
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
      entity: "invoices",
      entityId: result.invoiceId,
      action: "invoice_created",
      changes: { invoiceNo: result.invoiceNo, customerId, invoiceDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true, invoiceId: result.invoiceId };
}

// ─── Update Draft Invoice ─────────────────────────────────────────────────────

export async function updateInvoiceAction(
  id: string,
  data: SaveInvoiceValues
): Promise<{
  success: boolean;
  error?: string;
  notFound?: boolean;
  notDraft?: boolean;
}> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid invoice ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:invoice:update", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = saveInvoiceSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const {
    customerId,
    invoiceDate,
    dueDate,
    periodId,
    receivableAccountId,
    lines,
  } = parsed.data;

  const reference = parsed.data.reference?.trim() || null;
  const notes = parsed.data.notes?.trim() || null;

  let result:
    | { ok: true; invoiceId: string }
    | { ok: false; error: string; notFound?: boolean; notDraft?: boolean };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const [existing] = await tx
          .select({ id: invoices.id, status: invoices.status })
          .from(invoices)
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)))
          .limit(1);

        if (!existing) return { ok: false as const, error: "Invoice not found.", notFound: true };
        if (existing.status !== "draft") {
          return { ok: false as const, error: "Only draft invoices can be edited.", notDraft: true };
        }

        const computedLines = await computeLineAmounts(tx, user.tenant_id, lines);
        const subtotal = lines.reduce((s, l) => s + l.amount, 0);
        const taxTotal = computedLines.reduce((s, l) => s + l.taxAmount, 0);
        const total = subtotal + taxTotal;

        await tx
          .update(invoices)
          .set({
            customerId,
            invoiceDate,
            dueDate,
            periodId: periodId || null,
            reference,
            notes,
            subtotal: String(subtotal),
            taxAmount: String(taxTotal),
            total: String(total),
            receivableAccountId,
            updatedAt: new Date(),
          })
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)));

        await tx
          .delete(invoiceLines)
          .where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.tenantId, user.tenant_id)));

        await tx.insert(invoiceLines).values(
          computedLines.map((l) => ({
            tenantId: user.tenant_id,
            invoiceId: id,
            sortOrder: l.sortOrder,
            accountId: l.accountId,
            description: l.description,
            amount: String(l.amount),
            taxRateId: l.taxRateId,
            taxAmount: String(l.taxAmount),
          }))
        );

        return { ok: true as const, invoiceId: id };
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
      entity: "invoices",
      entityId: result.invoiceId,
      action: "invoice_updated",
      changes: { customerId, invoiceDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// ─── Post Invoice → Journal Entry ─────────────────────────────────────────────

export async function postInvoiceAction(id: string): Promise<{
  success: boolean;
  error?: string;
  notFound?: boolean;
  notDraft?: boolean;
}> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid invoice ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  // Posting requires approve permission (AR invoices have a dedicated approve perm)
  const permError = requirePermission("accounts:invoice:approve", user);
  if (permError) return { success: false, error: permError.error };

  let result:
    | { ok: true; invoiceId: string; invoiceNo: string; journalId: string }
    | { ok: false; error: string; notFound?: boolean; notDraft?: boolean };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)))
          .limit(1);

        if (!invoice) return { ok: false as const, error: "Invoice not found.", notFound: true };
        if (invoice.status !== "draft") {
          return { ok: false as const, error: "Only draft invoices can be posted.", notDraft: true };
        }

        // Verify period is open
        if (invoice.periodId) {
          const [period] = await tx
            .select({ status: fiscalPeriods.status, name: fiscalPeriods.name })
            .from(fiscalPeriods)
            .where(eq(fiscalPeriods.id, invoice.periodId))
            .limit(1);

          if (period && period.status !== "open") {
            return {
              ok: false as const,
              error: `Period ${period.name} is closed — posting not allowed.`,
            };
          }
        }

        // Fetch invoice lines
        const lines = await tx
          .select({
            id: invoiceLines.id,
            accountId: invoiceLines.accountId,
            amount: invoiceLines.amount,
            taxRateId: invoiceLines.taxRateId,
            taxAmount: invoiceLines.taxAmount,
            description: invoiceLines.description,
          })
          .from(invoiceLines)
          .where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.tenantId, user.tenant_id)));

        if (lines.length === 0) {
          return { ok: false as const, error: "Invoice has no lines to post." };
        }

        // Resolve output tax account IDs
        const taxRateIds = [...new Set(lines.map((l) => l.taxRateId).filter(Boolean) as string[])];
        const taxRateMap = new Map<string, string | null>();

        if (taxRateIds.length > 0) {
          for (const trId of taxRateIds) {
            const [tr] = await tx
              .select({ id: taxRates.id, accountId: taxRates.accountId })
              .from(taxRates)
              .where(and(eq(taxRates.id, trId), eq(taxRates.tenantId, user.tenant_id)))
              .limit(1);
            taxRateMap.set(trId, tr?.accountId ?? null);
          }
        }

        // Build journal lines:
        // AR (invoices): single DR on receivable account, multiple CRs on income lines
        // This is the INVERSE of AP (bills): bills had multiple DRs, single CR
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

        // Single DR: receivable account for invoice total
        const invoiceTotal = parseFloat(invoice.total);
        jLines.push({
          tenantId: user.tenant_id,
          accountId: invoice.receivableAccountId,
          debit: String(invoiceTotal),
          credit: "0",
          description: `AR: ${invoice.invoiceNo}`,
          costCenterId: null,
        });

        // Multiple CRs: income accounts per line (+ optional output tax CR)
        for (const line of lines) {
          const lineAmount = parseFloat(line.amount);
          const lineTaxAmount = parseFloat(line.taxAmount);
          const taxAccId = line.taxRateId ? taxRateMap.get(line.taxRateId) ?? null : null;

          if (taxAccId && lineTaxAmount > 0) {
            // Output tax: separate CR for income and tax liability account
            jLines.push({
              tenantId: user.tenant_id,
              accountId: line.accountId,
              debit: "0",
              credit: String(lineAmount),
              description: line.description,
              costCenterId: null,
            });
            jLines.push({
              tenantId: user.tenant_id,
              accountId: taxAccId,
              debit: "0",
              credit: String(lineTaxAmount),
              description: `Output tax on: ${line.description ?? invoice.invoiceNo}`,
              costCenterId: null,
            });
          } else {
            // No separate tax account: fold tax into income credit
            jLines.push({
              tenantId: user.tenant_id,
              accountId: line.accountId,
              debit: "0",
              credit: String(lineAmount + lineTaxAmount),
              description: line.description,
              costCenterId: null,
            });
          }
        }

        // Verify journal balances
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
            entryDate: invoice.invoiceDate,
            periodId: invoice.periodId,
            source: "invoice",
            reference: invoice.invoiceNo,
            memo: invoice.reference ? `Customer invoice: ${invoice.reference}` : null,
            isPosted: true,
            createdBy: user.sub,
          })
          .returning({ id: journals.id });

        if (!inserted) return { ok: false as const, error: "Failed to create journal entry." };

        await tx.insert(journalLines).values(
          jLines.map((l) => ({ ...l, journalId: inserted.id }))
        );

        await tx
          .update(invoices)
          .set({ status: "posted", journalId: inserted.id, updatedAt: new Date() })
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)));

        return { ok: true as const, invoiceId: id, invoiceNo: invoice.invoiceNo, journalId: inserted.id };
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
      entity: "invoices",
      entityId: result.invoiceId,
      action: "invoice_posted",
      changes: { invoiceNo: result.invoiceNo, journalId: result.journalId },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// ─── Delete Draft Invoice ─────────────────────────────────────────────────────

export async function deleteInvoiceAction(id: string): Promise<{
  success: boolean;
  error?: string;
  notFound?: boolean;
  notDraft?: boolean;
}> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid invoice ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  // Invoices have a dedicated delete permission (unlike bills which reused create)
  const permError = requirePermission("accounts:invoice:delete", user);
  if (permError) return { success: false, error: permError.error };

  let result:
    | { ok: true; invoiceId: string; invoiceNo: string }
    | { ok: false; error: string; notFound?: boolean; notDraft?: boolean };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        const [existing] = await tx
          .select({ id: invoices.id, status: invoices.status, invoiceNo: invoices.invoiceNo })
          .from(invoices)
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)))
          .limit(1);

        if (!existing) return { ok: false as const, error: "Invoice not found.", notFound: true };
        if (existing.status !== "draft") {
          return {
            ok: false as const,
            error: "Only draft invoices can be deleted.",
            notDraft: true,
          };
        }

        // CASCADE on invoice_lines handles lines automatically
        await tx
          .delete(invoices)
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)));

        return { ok: true as const, invoiceId: id, invoiceNo: existing.invoiceNo };
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
      entity: "invoices",
      entityId: result.invoiceId,
      action: "invoice_deleted",
      changes: { invoiceNo: result.invoiceNo },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
