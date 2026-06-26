import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  journalLines, journals, accounts, accountGroups,
  invoices, bills, contacts, fiscalPeriods,
} from "@/lib/db/schema";
import { ReportsView } from "@/components/app/accounts/reports-view";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/reports");
  }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const sp = await searchParams;
  const tab = sp.tab ?? "trial-balance";
  const fromDate = sp.from ?? null;
  const toDate = sp.to ?? null;
  const asOfDate = sp.date ?? new Date().toISOString().slice(0, 10);

  const tid = user.tenant_id;

  // ── Trial Balance ────────────────────────────────────────────────────────────
  const trialBalanceRows = await db
    .select({
      accountId: journalLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      groupName: accountGroups.name,
      groupType: accountGroups.type,
      totalDebit: sql<string>`SUM(${journalLines.debit})`,
      totalCredit: sql<string>`SUM(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .leftJoin(accountGroups, eq(accounts.groupId, accountGroups.id))
    .where(and(eq(journalLines.tenantId, tid), eq(journals.isPosted, true)))
    .groupBy(journalLines.accountId, accounts.code, accounts.name, accountGroups.name, accountGroups.type)
    .orderBy(accounts.code);

  // ── P&L ─────────────────────────────────────────────────────────────────────
  const plConditions = [eq(journalLines.tenantId, tid), eq(journals.isPosted, true)];
  if (fromDate) plConditions.push(sql`${journals.entryDate} >= ${fromDate}`);
  if (toDate) plConditions.push(sql`${journals.entryDate} <= ${toDate}`);

  const plRows = await db
    .select({
      groupType: accountGroups.type,
      groupName: accountGroups.name,
      accountCode: accounts.code,
      accountName: accounts.name,
      net: sql<string>`SUM(${journalLines.debit}) - SUM(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(accountGroups, eq(accounts.groupId, accountGroups.id))
    .where(and(...plConditions, sql`${accountGroups.type} IN ('income', 'revenue', 'expense', 'cost_of_sales')`))
    .groupBy(accountGroups.type, accountGroups.name, accounts.code, accounts.name)
    .orderBy(accountGroups.type, accounts.code);

  // ── Balance Sheet ────────────────────────────────────────────────────────────
  const bsRows = await db
    .select({
      groupType: accountGroups.type,
      groupName: accountGroups.name,
      accountCode: accounts.code,
      accountName: accounts.name,
      net: sql<string>`SUM(${journalLines.debit}) - SUM(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .innerJoin(accountGroups, eq(accounts.groupId, accountGroups.id))
    .where(and(
      eq(journalLines.tenantId, tid),
      eq(journals.isPosted, true),
      sql`${journals.entryDate} <= ${asOfDate}`,
      sql`${accountGroups.type} IN ('asset', 'liability', 'equity')`
    ))
    .groupBy(accountGroups.type, accountGroups.name, accounts.code, accounts.name)
    .orderBy(accountGroups.type, accounts.code);

  // ── AR Ageing ────────────────────────────────────────────────────────────────
  const arRows = await db
    .select({
      invoiceNo: invoices.invoiceNo,
      customerName: contacts.name,
      dueDate: invoices.dueDate,
      total: invoices.total,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.customerId, contacts.id))
    .where(and(eq(invoices.tenantId, tid), eq(invoices.status, "posted")))
    .orderBy(invoices.dueDate);

  // ── AP Ageing ────────────────────────────────────────────────────────────────
  const apRows = await db
    .select({
      billNo: bills.billNo,
      vendorName: contacts.name,
      dueDate: bills.dueDate,
      total: bills.total,
    })
    .from(bills)
    .innerJoin(contacts, eq(bills.vendorId, contacts.id))
    .where(and(eq(bills.tenantId, tid), eq(bills.status, "posted")))
    .orderBy(bills.dueDate);

  // ── Fiscal periods for filter ────────────────────────────────────────────────
  const periods = await db
    .select({ id: fiscalPeriods.id, name: fiscalPeriods.name })
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.tenantId, tid))
    .orderBy(desc(fiscalPeriods.startDate));

  return (
    <div className="p-6">
      <ReportsView
        activeTab={tab}
        trialBalance={trialBalanceRows}
        plRows={plRows}
        bsRows={bsRows}
        arRows={arRows}
        apRows={apRows}
        periods={periods}
        fromDate={fromDate}
        toDate={toDate}
        asOfDate={asOfDate}
      />
    </div>
  );
}
