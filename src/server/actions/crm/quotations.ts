"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import {
  quotations,
  quotationLines,
  numberSeries,
  invoices,
} from "@/lib/db/schema";
import { saveQuotationSchema } from "@/lib/validations/crm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/quotations";

type Tx = Parameters<Parameters<typeof withTenantRLS>[1]>[0];
type State = { success: true; id?: string } | { success: false; error: string } | null;

async function nextQuoteNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(and(eq(numberSeries.tenantId, tenantId), eq(numberSeries.docType, "quotation")))
    .returning();
  if (!updated) return `QT-${String(Date.now()).slice(-8)}`;
  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

async function nextInvoiceNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(and(eq(numberSeries.tenantId, tenantId), eq(numberSeries.docType, "invoice")))
    .returning();
  if (!updated) return `INV-${String(Date.now()).slice(-8)}`;
  const num = updated.nextNumber - 1;
  const padded = String(num).padStart(updated.padding, "0");
  return updated.prefix ? `${updated.prefix}${padded}` : padded;
}

function parseLinesFromFormData(formData: FormData) {
  const lines: Array<{ itemId: string | null; description: string; quantity: string; unitPrice: string }> = [];
  let i = 0;
  while (formData.has(`lines[${i}][description]`)) {
    lines.push({
      itemId: (formData.get(`lines[${i}][itemId]`) as string) || null,
      description: (formData.get(`lines[${i}][description]`) as string)?.trim() ?? "",
      quantity: (formData.get(`lines[${i}][quantity]`) as string) ?? "1",
      unitPrice: (formData.get(`lines[${i}][unitPrice]`) as string) ?? "0",
    });
    i++;
  }
  return lines;
}

export async function createQuotationAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:quotation:create", user);
  if (permError) return permError;

  const rawLines = parseLinesFromFormData(formData);
  const parsed = saveQuotationSchema.safeParse({
    opportunityId: (formData.get("opportunityId") as string) || null,
    companyId: (formData.get("companyId") as string) || null,
    quoteDate: (formData.get("quoteDate") as string)?.trim(),
    validUntil: (formData.get("validUntil") as string) || null,
    lines: rawLines,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let newId: string;
  try {
    newId = await withTenantRLS(ctx, async (tx) => {
      const quoteNo = await nextQuoteNo(tx, user.tenant_id);

      let subtotal = 0;
      const lineValues = parsed.data.lines.map((l) => {
        const qty = parseFloat(l.quantity);
        const price = parseFloat(l.unitPrice);
        const lineTotal = qty * price;
        subtotal += lineTotal;
        return { ...l, lineTotal };
      });

      const [inserted] = await tx
        .insert(quotations)
        .values({
          tenantId: user.tenant_id,
          quoteNo,
          opportunityId: parsed.data.opportunityId ?? null,
          companyId: parsed.data.companyId ?? null,
          quoteDate: parsed.data.quoteDate,
          validUntil: parsed.data.validUntil ?? null,
          subtotal: String(subtotal),
          taxTotal: "0",
          total: String(subtotal),
          status: "draft",
        })
        .returning({ id: quotations.id });

      const id = inserted!.id;

      await tx.insert(quotationLines).values(
        lineValues.map((l) => ({
          tenantId: user.tenant_id,
          quotationId: id,
          itemId: l.itemId ?? null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: String(l.lineTotal),
        }))
      );

      return id;
    });
  } catch {
    return { success: false, error: "Failed to create quotation." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "quotations", entityId: newId, action: "created", changes: {} });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true, id: newId };
}

export async function updateQuotationStatusAction(
  quotationId: string,
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(quotationId)) return { success: false, error: "Invalid quotation ID." };
  const permError = requirePermission("crm:quotation:approve", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) =>
      tx.update(quotations).set({ status })
        .where(and(eq(quotations.id, quotationId), eq(quotations.tenantId, user.tenant_id)))
    );
  } catch {
    return { success: false, error: "Failed to update quotation status." };
  }
  revalidatePath(REVALIDATE);
  return { success: true };
}

/**
 * Convert an accepted quotation to a draft invoice header.
 * Requires customerId (AP/AR contacts.id) and receivableAccountId from the caller.
 * Invoice lines are not auto-created — the user completes them in the invoice editor.
 */
export async function convertQuotationToInvoiceAction(
  quotationId: string,
  customerId: string,
  receivableAccountId: string
): Promise<{ success: boolean; error?: string; invoiceId?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(quotationId)) return { success: false, error: "Invalid quotation ID." };
  if (!UUID_RE.test(customerId)) return { success: false, error: "Invalid customer ID." };
  if (!UUID_RE.test(receivableAccountId)) return { success: false, error: "Invalid receivable account ID." };

  const permError = requirePermission("crm:quotation:approve", user);
  if (permError) return { success: false, error: permError.error };
  const invPermError = requirePermission("accounts:invoice:create", user);
  if (invPermError) return { success: false, error: "Invoice creation permission required." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let invoiceId: string;
  try {
    invoiceId = await withTenantRLS(ctx, async (tx) => {
      const [quot] = await tx.select().from(quotations)
        .where(and(eq(quotations.id, quotationId), eq(quotations.tenantId, user.tenant_id))).limit(1);
      if (!quot) throw new Error("Quotation not found.");
      if (quot.status !== "accepted") throw new Error("Only accepted quotations can be converted.");
      if (quot.invoiceId) throw new Error("This quotation has already been converted to an invoice.");

      const invoiceNo = await nextInvoiceNo(tx, user.tenant_id);

      const [inv] = await tx.insert(invoices).values({
        tenantId: user.tenant_id,
        customerId,
        invoiceNo,
        invoiceDate: quot.quoteDate,
        dueDate: quot.validUntil ?? quot.quoteDate,
        status: "draft",
        subtotal: quot.subtotal ?? "0",
        taxAmount: quot.taxTotal ?? "0",
        total: quot.total ?? "0",
        receivableAccountId,
        createdBy: user.sub,
      }).returning({ id: invoices.id });

      const invId = inv!.id;

      await tx.update(quotations).set({ invoiceId: invId })
        .where(and(eq(quotations.id, quotationId), eq(quotations.tenantId, user.tenant_id)));

      return invId;
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to convert quotation.";
    return { success: false, error: msg };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "quotations", entityId: quotationId, action: "converted_to_invoice", changes: { invoiceId } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  revalidatePath("/app/accounts/invoices");
  return { success: true, invoiceId };
}
