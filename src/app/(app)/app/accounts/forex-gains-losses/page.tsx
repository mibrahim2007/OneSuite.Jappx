import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, desc, ne } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { bills, invoices, payments } from "@/lib/db/schema";
import type { FxTransaction } from "@/components/app/multicurrency/forex-gains-losses-view";
import { ForexGainsLossesView } from "@/components/app/multicurrency/forex-gains-losses-view";

export default async function ForexGainsLossesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/forex-gains-losses");
  }

  const permError = requirePermission("accounts:reports:view", user);
  if (permError) redirect("/app/dashboard");

  const [fxBills, fxInvoices, fxPayments] = await Promise.all([
    db
      .select({ id: bills.id, ref: bills.billNo, date: bills.billDate, currency: bills.currencyCode, rate: bills.exchangeRate, amount: bills.total })
      .from(bills)
      .where(and(eq(bills.tenantId, user.tenant_id), ne(bills.currencyCode, "PKR")))
      .orderBy(desc(bills.billDate))
      .limit(100),

    db
      .select({ id: invoices.id, ref: invoices.invoiceNo, date: invoices.invoiceDate, currency: invoices.currencyCode, rate: invoices.exchangeRate, amount: invoices.total })
      .from(invoices)
      .where(and(eq(invoices.tenantId, user.tenant_id), ne(invoices.currencyCode, "PKR")))
      .orderBy(desc(invoices.invoiceDate))
      .limit(100),

    db
      .select({ id: payments.id, ref: payments.paymentNo, date: payments.paymentDate, currency: payments.currencyCode, rate: payments.exchangeRate, amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.tenantId, user.tenant_id), ne(payments.currencyCode, "PKR")))
      .orderBy(desc(payments.paymentDate))
      .limit(100),
  ]);

  const allTransactions: FxTransaction[] = [
    ...fxBills.map((r) => ({ ...r, type: "Bill" as const })),
    ...fxInvoices.map((r) => ({ ...r, type: "Invoice" as const })),
    ...fxPayments.map((r) => ({ ...r, type: "Payment" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return <ForexGainsLossesView transactions={allTransactions} />;
}
