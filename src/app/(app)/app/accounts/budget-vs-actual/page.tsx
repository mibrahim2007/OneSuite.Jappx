import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { budgets, budgetLines, journalLines, journals, accounts, accountGroups } from "@/lib/db/schema";
import { BudgetVsActual } from "@/components/app/accounts/budget-vs-actual";

export default async function BudgetVsActualPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try { user = await verifyAccessToken(token); }
  catch { redirect("/api/auth/refresh?next=/app/accounts/budget-vs-actual"); }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const sp = await searchParams;
  const tid = user.tenant_id;

  // Load available active budgets for selector
  const allBudgets = await db
    .select({ id: budgets.id, name: budgets.name, fiscalYear: budgets.fiscalYear, status: budgets.status })
    .from(budgets)
    .where(eq(budgets.tenantId, tid))
    .orderBy(budgets.fiscalYear);

  const selectedBudgetId = sp.budget ?? allBudgets.find((b) => b.status === "active")?.id ?? allBudgets[0]?.id;

  if (!selectedBudgetId) {
    return <BudgetVsActual rows={[]} budgets={allBudgets} selectedBudgetId="" fromMonth="" toMonth="" />;
  }

  const fromMonth = sp.from ?? "";
  const toMonth = sp.to ?? "";

  // Budget totals per account
  const budgetTotals = await db
    .select({
      accountId: budgetLines.accountId,
      budgeted: sql<string>`SUM(${budgetLines.amount})`,
    })
    .from(budgetLines)
    .where(
      and(
        eq(budgetLines.budgetId, selectedBudgetId),
        eq(budgetLines.tenantId, tid),
        ...(fromMonth ? [sql`${budgetLines.periodMonth} >= ${fromMonth}`] : []),
        ...(toMonth ? [sql`${budgetLines.periodMonth} <= ${toMonth}`] : []),
      )
    )
    .groupBy(budgetLines.accountId);

  const accountIds = budgetTotals.map((r) => r.accountId);

  // Actual totals per account from posted journals
  const actualTotals =
    accountIds.length > 0
      ? await db
          .select({
            accountId: journalLines.accountId,
            debit: sql<string>`SUM(${journalLines.debit})`,
            credit: sql<string>`SUM(${journalLines.credit})`,
          })
          .from(journalLines)
          .innerJoin(journals, and(eq(journalLines.journalId, journals.id), eq(journals.isPosted, true)))
          .where(
            and(
              eq(journalLines.tenantId, tid),
              sql`${journalLines.accountId} = ANY(ARRAY[${sql.raw(accountIds.map((id) => `'${id}'::uuid`).join(","))}])`,
              ...(fromMonth ? [sql`to_char(${journals.entryDate}, 'YYYY-MM') >= ${fromMonth}`] : []),
              ...(toMonth ? [sql`to_char(${journals.entryDate}, 'YYYY-MM') <= ${toMonth}`] : []),
            )
          )
          .groupBy(journalLines.accountId)
      : [];

  const actualMap = new Map(actualTotals.map((r) => [r.accountId, { debit: parseFloat(r.debit ?? "0"), credit: parseFloat(r.credit ?? "0") }]));

  // Account details
  const accountDetails = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
    .from(accounts)
    .where(eq(accounts.tenantId, tid));
  const accountMap = new Map(accountDetails.map((a) => [a.id, a]));

  const rows = budgetTotals.map((b) => {
    const acct = accountMap.get(b.accountId);
    const act = actualMap.get(b.accountId);
    const budgeted = parseFloat(b.budgeted ?? "0");
    // For expense/asset accounts: actual = debit - credit; for income/liability: credit - debit
    const isExpense = ["expense", "asset"].includes(acct?.type ?? "");
    const actual = act ? (isExpense ? act.debit - act.credit : act.credit - act.debit) : 0;
    const variance = actual - budgeted;
    return {
      accountId: b.accountId,
      accountCode: acct?.code ?? "",
      accountName: acct?.name ?? "",
      accountType: acct?.type ?? "",
      budgeted,
      actual,
      variance,
      variancePct: budgeted !== 0 ? (variance / Math.abs(budgeted)) * 100 : 0,
    };
  });

  rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return (
    <BudgetVsActual
      rows={rows}
      budgets={allBudgets}
      selectedBudgetId={selectedBudgetId}
      fromMonth={fromMonth}
      toMonth={toMonth}
    />
  );
}
