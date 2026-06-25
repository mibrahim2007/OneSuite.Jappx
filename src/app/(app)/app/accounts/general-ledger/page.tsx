import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { accounts, fiscalPeriods, journalLines, journals } from "@/lib/db/schema";
import { GlRegister } from "@/components/app/accounts/gl-register";

// UUID validation — rejects malformed values before they reach Postgres uuid columns
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = {
  accountId?: string;
  periodId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/general-ledger");
  }

  const permError = requirePermission("accounts:journal:view", user);
  if (permError) redirect("/app/dashboard");

  const raw = await searchParams;
  // Sanitise UUID params — Postgres throws on non-UUID strings for uuid columns
  const accountId = UUID_RE.test(raw.accountId ?? "") ? raw.accountId : undefined;
  const periodId = UUID_RE.test(raw.periodId ?? "") ? raw.periodId : undefined;
  const dateFrom = raw.dateFrom;
  const dateTo = raw.dateTo;

  // Resolve period start date for opening-balance only — NOT injected as date-range filters.
  // postJournalAction does not validate that entryDate falls within the period's date bounds,
  // so adding gte/lte alongside periodId would silently exclude cross-boundary entries.
  let periodStartDate: string | null = null;
  if (periodId) {
    const [p] = await db
      .select({ startDate: fiscalPeriods.startDate })
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.id, periodId), eq(fiscalPeriods.tenantId, user.tenant_id)))
      .limit(1);
    if (p) periodStartDate = p.startDate;
  }

  // Parallel fetch: filter select options
  const [allPeriods, allAccounts] = await Promise.all([
    db
      .select({ id: fiscalPeriods.id, name: fiscalPeriods.name, startDate: fiscalPeriods.startDate })
      .from(fiscalPeriods)
      .where(eq(fiscalPeriods.tenantId, user.tenant_id))
      .orderBy(asc(fiscalPeriods.startDate)),
    db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isActive, true)))
      .orderBy(asc(accounts.code)),
  ]);

  // Main GL query — only posted journals, with optional filters
  const glRows = await db
    .select({
      lineId: journalLines.id,
      journalId: journals.id,
      entryNo: journals.entryNo,
      entryDate: journals.entryDate,
      journalMemo: journals.memo,
      accountId: journalLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      periodName: fiscalPeriods.name,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journalLines.journalId, journals.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .leftJoin(fiscalPeriods, eq(journals.periodId, fiscalPeriods.id))
    .where(
      and(
        eq(journals.tenantId, user.tenant_id),
        eq(journals.isPosted, true),
        eq(accounts.tenantId, user.tenant_id),
        accountId ? eq(journalLines.accountId, accountId) : undefined,
        periodId  ? eq(journals.periodId, periodId)   : undefined,
        dateFrom  ? gte(journals.entryDate, dateFrom)  : undefined,
        dateTo    ? lte(journals.entryDate, dateTo)    : undefined,
      )
    )
    .orderBy(asc(journals.entryDate), asc(journals.createdAt), asc(journalLines.id))
    .limit(500);

  // Running balance per-account computed in JS from ascending-sorted rows
  const balanceMap = new Map<string, number>();
  const rowsWithBalance = glRows.map((row) => {
    const prev = balanceMap.get(row.accountId) ?? 0;
    const balance = prev + parseFloat(row.debit) - parseFloat(row.credit);
    balanceMap.set(row.accountId, balance);
    return { ...row, runningBalance: balance };
  });

  // Opening / closing balance — both computed via DB aggregates, not from the truncated glRows.
  // effectiveFrom: explicit dateFrom when provided, otherwise period start date.
  const effectiveFrom = dateFrom ?? periodStartDate;
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  if (accountId && effectiveFrom) {
    const [ob, pn] = await Promise.all([
      // Balance accumulated before effectiveFrom
      db
        .select({
          v: sql<string>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), '0')`,
        })
        .from(journalLines)
        .innerJoin(journals, eq(journalLines.journalId, journals.id))
        .where(
          and(
            eq(journals.tenantId, user.tenant_id),
            eq(journals.isPosted, true),
            eq(journalLines.accountId, accountId),
            lt(journals.entryDate, effectiveFrom),
          )
        ),
      // Net movement during the filtered period — mirrors main GL query filters exactly
      db
        .select({
          v: sql<string>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), '0')`,
        })
        .from(journalLines)
        .innerJoin(journals, eq(journalLines.journalId, journals.id))
        .where(
          and(
            eq(journals.tenantId, user.tenant_id),
            eq(journals.isPosted, true),
            eq(journalLines.accountId, accountId),
            periodId ? eq(journals.periodId, periodId)  : undefined,
            dateFrom ? gte(journals.entryDate, dateFrom) : undefined,
            dateTo   ? lte(journals.entryDate, dateTo)   : undefined,
          )
        ),
    ]);
    openingBalance = parseFloat(ob[0]?.v ?? "0");
    closingBalance = openingBalance + parseFloat(pn[0]?.v ?? "0");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">General Ledger</h1>
      <p className="text-sm text-muted-foreground mt-1">
        All posted journal lines with running account balances.
      </p>
      <div className="mt-6">
        <GlRegister
          rows={rowsWithBalance}
          allPeriods={allPeriods}
          allAccounts={allAccounts}
          filters={{ accountId, periodId, dateFrom, dateTo }}
          openingBalance={openingBalance}
          closingBalance={closingBalance}
          truncated={glRows.length === 500}
        />
      </div>
    </div>
  );
}
