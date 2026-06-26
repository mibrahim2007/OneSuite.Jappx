import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { payments, contacts, accounts, bills, invoices } from "@/lib/db/schema";
import { PaymentsView } from "@/components/app/accounts/payments-view";

export default async function PaymentsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/payments");
  }

  const permError = requirePermission("accounts:payment:view", user);
  if (permError) redirect("/app/dashboard");

  const canCreate = user.permissions.includes("accounts:payment:create");

  const [rows, postedBills, postedInvoices, bankAccounts] = await Promise.all([
    db
      .select({
        id: payments.id,
        paymentNo: payments.paymentNo,
        direction: payments.direction,
        method: payments.method,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        reference: payments.reference,
        partyName: contacts.name,
        bankAccountName: accounts.name,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(contacts, eq(payments.partyId, contacts.id))
      .leftJoin(accounts, eq(payments.bankAccountId, accounts.id))
      .where(eq(payments.tenantId, user.tenant_id))
      .orderBy(desc(payments.createdAt)),

    db
      .select({ id: bills.id, billNo: bills.billNo, total: bills.total, vendorId: bills.vendorId, vendorName: contacts.name })
      .from(bills)
      .leftJoin(contacts, eq(bills.vendorId, contacts.id))
      .where(and(eq(bills.tenantId, user.tenant_id), eq(bills.status, "posted")))
      .orderBy(desc(bills.billDate)),

    db
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo, total: invoices.total, customerId: invoices.customerId, customerName: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.customerId, contacts.id))
      .where(and(eq(invoices.tenantId, user.tenant_id), eq(invoices.status, "posted")))
      .orderBy(desc(invoices.invoiceDate)),

    db
      .select({ id: accounts.id, name: accounts.name, code: accounts.code })
      .from(accounts)
      .where(and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isBank, true), eq(accounts.isActive, true)))
      .orderBy(accounts.code),
  ]);

  return (
    <div className="p-6">
      <PaymentsView
        rows={rows}
        postedBills={postedBills}
        postedInvoices={postedInvoices}
        bankAccounts={bankAccounts}
        canCreate={canCreate}
      />
    </div>
  );
}
