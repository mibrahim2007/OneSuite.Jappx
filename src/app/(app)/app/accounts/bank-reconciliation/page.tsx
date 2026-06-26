import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, desc, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { accounts, bankStatements, bankStatementLines, journalLines, journals } from "@/lib/db/schema";
import { BankReconciliationView } from "@/components/app/multicurrency/bank-reconciliation-view";

export default async function BankReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ statementId?: string }>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/bank-reconciliation");
  }

  const permError = requirePermission("accounts:journal:view", user);
  if (permError) redirect("/app/dashboard");

  const canPost = user.permissions.includes("accounts:journal:post");

  const params = await searchParams;

  // All bank accounts
  const bankAccounts = await db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isBank, true), eq(accounts.isActive, true)))
    .orderBy(accounts.code);

  // All statements
  const statements = await db
    .select()
    .from(bankStatements)
    .where(eq(bankStatements.tenantId, user.tenant_id))
    .orderBy(desc(bankStatements.statementDate));

  // If a statement is selected, load its lines + unmatched GL lines
  let statementLines: typeof bankStatementLines.$inferSelect[] = [];
  let selectedStatement: typeof bankStatements.$inferSelect | null = null;
  let unmatchedGlLines: { id: string; date: string; description: string | null; debit: string; credit: string; entryNo: string }[] = [];

  if (params.statementId) {
    selectedStatement = statements.find((s) => s.id === params.statementId) ?? null;

    if (selectedStatement) {
      statementLines = await db
        .select()
        .from(bankStatementLines)
        .where(and(
          eq(bankStatementLines.tenantId, user.tenant_id),
          eq(bankStatementLines.statementId, selectedStatement.id)
        ))
        .orderBy(bankStatementLines.lineDate);

      // GL lines for the same bank account, unmatched
      unmatchedGlLines = await db
        .select({
          id: journalLines.id,
          date: journals.entryDate,
          description: journalLines.description,
          debit: journalLines.debit,
          credit: journalLines.credit,
          entryNo: journals.entryNo,
        })
        .from(journalLines)
        .innerJoin(journals, eq(journalLines.journalId, journals.id))
        .where(and(
          eq(journalLines.tenantId, user.tenant_id),
          eq(journalLines.accountId, selectedStatement.accountId),
          eq(journals.isPosted, true)
        ))
        .orderBy(desc(journals.entryDate))
        .limit(200) as { id: string; date: string; description: string | null; debit: string; credit: string; entryNo: string }[];
    }
  }

  return (
    <BankReconciliationView
      bankAccounts={bankAccounts}
      statements={statements}
      selectedStatement={selectedStatement}
      statementLines={statementLines}
      unmatchedGlLines={unmatchedGlLines}
      canPost={canPost}
    />
  );
}
