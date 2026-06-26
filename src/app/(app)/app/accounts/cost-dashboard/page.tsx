import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { journals, journalLines, accounts } from "@/lib/db/schema";
import { CostDashboardView } from "@/components/app/accounts/cost-dashboard-view";

export default async function CostDashboardPage({
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
    redirect("/api/auth/refresh?next=/app/accounts/cost-dashboard");
  }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const defaultMonth = today.slice(0, 7);
  const selectedMonth = sp.month ?? defaultMonth;
  const fromDate = `${selectedMonth}-01`;
  const lastDay = new Date(parseInt(selectedMonth.slice(0, 4)), parseInt(selectedMonth.slice(5, 7)), 0).getDate();
  const toDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

  const tid = user.tenant_id;

  // Cost by source and account for selected month
  const costRows = await db
    .select({
      source: journals.source,
      accountCode: accounts.code,
      accountName: accounts.name,
      totalDebit: sql<string>`SUM(${journalLines.debit})`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(journals.tenantId, tid),
        eq(journals.isPosted, true),
        gte(journals.entryDate, fromDate),
        lte(journals.entryDate, toDate),
        sql`${journals.source} IN ('fleet', 'maintenance', 'payroll')`
      )
    )
    .groupBy(journals.source, accounts.code, accounts.name)
    .orderBy(journals.source, accounts.code);

  // 6-month trend — one row per month per source
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const trendFrom = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;

  const trendRows = await db
    .select({
      month: sql<string>`TO_CHAR(${journals.entryDate}::date, 'YYYY-MM')`,
      source: journals.source,
      totalDebit: sql<string>`SUM(${journalLines.debit})`,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .where(
      and(
        eq(journals.tenantId, tid),
        eq(journals.isPosted, true),
        gte(journals.entryDate, trendFrom),
        sql`${journals.source} IN ('fleet', 'maintenance', 'payroll')`
      )
    )
    .groupBy(sql`TO_CHAR(${journals.entryDate}::date, 'YYYY-MM')`, journals.source)
    .orderBy(sql`TO_CHAR(${journals.entryDate}::date, 'YYYY-MM')`, journals.source);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Operational Cost Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Cross-module cost view: Fleet, Maintenance &amp; Payroll expenses from the General Ledger.
      </p>
      <CostDashboardView
        selectedMonth={selectedMonth}
        costRows={costRows}
        trendRows={trendRows}
      />
    </div>
  );
}
