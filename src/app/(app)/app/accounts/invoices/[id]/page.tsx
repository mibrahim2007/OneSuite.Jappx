import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  accounts,
  invoiceLines,
  invoices,
  contacts,
  fiscalPeriods,
  taxRates,
} from "@/lib/db/schema";
import { InvoiceForm } from "@/components/app/accounts/invoice-form";
import { InvoiceDetail } from "@/components/app/accounts/invoice-detail";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) redirect("/app/accounts/invoices");

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/app/accounts/invoices/${id}`);
  }

  const permError = requirePermission("accounts:invoice:view", user);
  if (permError) redirect("/app/dashboard");

  const [invoiceRows, lineRows] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenant_id)))
      .limit(1),
    db
      .select()
      .from(invoiceLines)
      .where(
        and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.tenantId, user.tenant_id))
      )
      .orderBy(asc(invoiceLines.sortOrder)),
  ]);

  const invoice = invoiceRows[0];
  if (!invoice) redirect("/app/accounts/invoices");

  const canManage =
    user.permissions.includes("accounts:invoice:update") ||
    user.permissions.includes("accounts:invoice:create");

  // Non-draft invoices → read-only detail view with payment option
  if (invoice.status !== "draft") {
    const canRecordPayment =
      invoice.status === "posted" &&
      user.permissions.includes("accounts:payment:create");

    const [bankAccountRows, customerRows] = await Promise.all([
      canRecordPayment
        ? db
            .select({ id: accounts.id, name: accounts.name, code: accounts.code })
            .from(accounts)
            .where(and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isBank, true), eq(accounts.isActive, true)))
            .orderBy(accounts.code)
        : Promise.resolve([] as { id: string; name: string; code: string }[]),
      db
        .select({ name: contacts.name })
        .from(contacts)
        .where(eq(contacts.id, invoice.customerId))
        .limit(1),
    ]);

    return (
      <div className="p-6">
        <InvoiceDetail
          invoice={invoice}
          lines={lineRows}
          bankAccounts={bankAccountRows}
          customerName={customerRows[0]?.name ?? null}
          canRecordPayment={canRecordPayment}
        />
      </div>
    );
  }

  // Draft invoices without manage permission → read-only detail view
  if (!canManage) {
    return (
      <div className="p-6">
        <InvoiceDetail invoice={invoice} lines={lineRows} bankAccounts={[]} customerName={null} canRecordPayment={false} />
      </div>
    );
  }

  // Draft invoices with manage permission → editable form
  const [customerRows, accountRows, periodRows, taxRateRows] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, user.tenant_id),
          eq(contacts.isActive, true),
          inArray(contacts.type, ["customer", "both"])
        )
      )
      .orderBy(asc(contacts.name)),
    db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isActive, true))
      )
      .orderBy(asc(accounts.code)),
    db
      .select()
      .from(fiscalPeriods)
      .where(
        and(
          eq(fiscalPeriods.tenantId, user.tenant_id),
          eq(fiscalPeriods.status, "open")
        )
      )
      .orderBy(asc(fiscalPeriods.startDate)),
    db
      .select()
      .from(taxRates)
      .where(
        and(eq(taxRates.tenantId, user.tenant_id), eq(taxRates.isActive, true))
      )
      .orderBy(asc(taxRates.name)),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Edit Invoice — {invoice.invoiceNo}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Update this draft invoice before posting.
      </p>
      <div className="mt-6">
        <InvoiceForm
          customers={customerRows}
          accounts={accountRows}
          openPeriods={periodRows}
          taxRates={taxRateRows}
          initialData={{ ...invoice, lines: lineRows }}
        />
      </div>
    </div>
  );
}
