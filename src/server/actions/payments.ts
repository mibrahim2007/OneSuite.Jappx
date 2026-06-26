"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import {
  payments,
  paymentAllocations,
  bills,
  invoices,
  journals,
  journalLines,
  numberSeries,
} from "@/lib/db/schema";
import { createPaymentSchema } from "@/lib/validations/payments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Tx = Parameters<Parameters<typeof withTenantRLS>[1]>[0];

async function nextPaymentNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(and(eq(numberSeries.tenantId, tenantId), eq(numberSeries.docType, "payment")))
    .returning();
  if (!updated) return `PAY-${String(Date.now()).slice(-8)}`;
  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

async function nextJournalNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(and(eq(numberSeries.tenantId, tenantId), eq(numberSeries.docType, "journal")))
    .returning();
  if (!updated) return `JV-${String(Date.now()).slice(-8)}`;
  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

export async function createPaymentAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:payment:create", user);
  if (permError) return { success: false, error: permError.error };

  const raw = {
    direction: formData.get("direction"),
    billId: formData.get("billId") || null,
    invoiceId: formData.get("invoiceId") || null,
    partyId: formData.get("partyId"),
    bankAccountId: formData.get("bankAccountId"),
    method: formData.get("method"),
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference") || null,
  };

  const parsed = createPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { direction, billId, invoiceId, partyId, bankAccountId, method, amount, paymentDate, reference } = parsed.data;
  const amountNum = parseFloat(amount);

  // Validate UUIDs for doc IDs
  if (billId && !UUID_RE.test(billId)) return { success: false, error: "Invalid bill ID." };
  if (invoiceId && !UUID_RE.test(invoiceId)) return { success: false, error: "Invalid invoice ID." };

  let result: { ok: true; paymentId: string; paymentNo: string } | { ok: false; error: string };

  try {
    result = await withTenantRLS(
      { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
      async (tx) => {
        // Resolve the clearance account (payable for outbound, receivable for inbound)
        let clearanceAccountId: string;
        let docNo: string;

        if (direction === "outbound" && billId) {
          const [bill] = await tx
            .select({ status: bills.status, payableAccountId: bills.payableAccountId, billNo: bills.billNo })
            .from(bills)
            .where(and(eq(bills.id, billId), eq(bills.tenantId, user.tenant_id)))
            .limit(1);
          if (!bill) return { ok: false as const, error: "Bill not found." };
          if (bill.status !== "posted") return { ok: false as const, error: "Only posted bills can be paid." };
          clearanceAccountId = bill.payableAccountId;
          docNo = bill.billNo;
        } else if (direction === "inbound" && invoiceId) {
          const [invoice] = await tx
            .select({ status: invoices.status, receivableAccountId: invoices.receivableAccountId, invoiceNo: invoices.invoiceNo })
            .from(invoices)
            .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, user.tenant_id)))
            .limit(1);
          if (!invoice) return { ok: false as const, error: "Invoice not found." };
          if (invoice.status !== "posted") return { ok: false as const, error: "Only posted invoices can be received against." };
          clearanceAccountId = invoice.receivableAccountId;
          docNo = invoice.invoiceNo;
        } else {
          return { ok: false as const, error: "Invalid payment configuration." };
        }

        // Build journal lines
        // Outbound: DR clearance (payable) / CR bank
        // Inbound:  DR bank / CR clearance (receivable)
        const jLines = direction === "outbound"
          ? [
              { tenantId: user.tenant_id, accountId: clearanceAccountId, debit: String(amountNum), credit: "0", description: `Payment: ${docNo}`, costCenterId: null },
              { tenantId: user.tenant_id, accountId: bankAccountId, debit: "0", credit: String(amountNum), description: `Payment: ${docNo}`, costCenterId: null },
            ]
          : [
              { tenantId: user.tenant_id, accountId: bankAccountId, debit: String(amountNum), credit: "0", description: `Receipt: ${docNo}`, costCenterId: null },
              { tenantId: user.tenant_id, accountId: clearanceAccountId, debit: "0", credit: String(amountNum), description: `Receipt: ${docNo}`, costCenterId: null },
            ];

        const entryNo = await nextJournalNo(tx, user.tenant_id);
        const [journal] = await tx
          .insert(journals)
          .values({
            tenantId: user.tenant_id,
            entryNo,
            entryDate: paymentDate,
            source: "payment",
            reference: reference ?? docNo,
            isPosted: true,
            createdBy: user.sub,
          })
          .returning({ id: journals.id });

        if (!journal) return { ok: false as const, error: "Failed to create journal." };

        await tx.insert(journalLines).values(
          jLines.map((l) => ({ ...l, journalId: journal.id }))
        );

        const paymentNo = await nextPaymentNo(tx, user.tenant_id);
        const [inserted] = await tx
          .insert(payments)
          .values({
            tenantId: user.tenant_id,
            paymentNo,
            direction,
            partyId,
            bankAccountId,
            method,
            amount: String(amountNum),
            paymentDate,
            reference: reference ?? null,
            journalId: journal.id,
          })
          .returning({ id: payments.id, paymentNo: payments.paymentNo });

        if (!inserted) return { ok: false as const, error: "Failed to create payment." };

        await tx.insert(paymentAllocations).values({
          tenantId: user.tenant_id,
          paymentId: inserted.id,
          invoiceId: invoiceId ?? null,
          billId: billId ?? null,
          amount: String(amountNum),
        });

        // Mark bill/invoice as paid
        if (direction === "outbound" && billId) {
          await tx.update(bills)
            .set({ status: "paid", updatedAt: new Date() })
            .where(and(eq(bills.id, billId), eq(bills.tenantId, user.tenant_id)));
        } else if (direction === "inbound" && invoiceId) {
          await tx.update(invoices)
            .set({ status: "paid", updatedAt: new Date() })
            .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, user.tenant_id)));
        }

        return { ok: true as const, paymentId: inserted.id, paymentNo: inserted.paymentNo };
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
      entity: "payments",
      entityId: result.paymentId,
      action: direction === "outbound" ? "payment_created" : "receipt_created",
      changes: { paymentNo: result.paymentNo, amount, direction },
    });
  } catch { /* non-fatal */ }

  revalidatePath("/app/accounts/payments");
  revalidatePath("/app/accounts/bills");
  revalidatePath("/app/accounts/invoices");
  return { success: true };
}
