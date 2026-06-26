import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { invoices, contacts } from "@/lib/db/schema";
import { InvoicesList } from "@/components/app/accounts/invoices-list";

export default async function InvoicesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/invoices");
  }

  const permError = requirePermission("accounts:invoice:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      customerId: invoices.customerId,
      invoiceNo: invoices.invoiceNo,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      periodId: invoices.periodId,
      reference: invoices.reference,
      notes: invoices.notes,
      status: invoices.status,
      subtotal: invoices.subtotal,
      taxAmount: invoices.taxAmount,
      total: invoices.total,
      receivableAccountId: invoices.receivableAccountId,
      journalId: invoices.journalId,
      createdBy: invoices.createdBy,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      currencyCode: invoices.currencyCode,
      exchangeRate: invoices.exchangeRate,
      customerName: contacts.name,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.customerId, contacts.id))
    .where(
      and(
        eq(invoices.tenantId, user.tenant_id),
        eq(contacts.tenantId, user.tenant_id)
      )
    )
    .orderBy(desc(invoices.createdAt));

  const canCreate = user.permissions.includes("accounts:invoice:create");
  const canDelete = user.permissions.includes("accounts:invoice:delete");
  const canApprove = user.permissions.includes("accounts:invoice:approve");

  return (
    <div className="p-6">
      <InvoicesList
        invoices={rows}
        canCreate={canCreate}
        canDelete={canDelete}
        canApprove={canApprove}
      />
    </div>
  );
}
