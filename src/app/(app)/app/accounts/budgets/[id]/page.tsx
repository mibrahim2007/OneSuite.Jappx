import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { budgets, budgetLines, accounts } from "@/lib/db/schema";
import { BudgetDetail } from "@/components/app/accounts/budget-detail";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try { user = await verifyAccessToken(token); }
  catch { redirect("/api/auth/refresh?next=/app/accounts/budgets"); }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const { id } = await params;

  const [budget] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.tenantId, user.tenant_id)));

  if (!budget) redirect("/app/accounts/budgets" as Route);

  const lines = await db
    .select()
    .from(budgetLines)
    .where(and(eq(budgetLines.budgetId, id), eq(budgetLines.tenantId, user.tenant_id)));

  const allAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type, groupId: accounts.groupId })
    .from(accounts)
    .where(and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isActive, true)))
    .orderBy(accounts.code);

  const canUpdate = user.permissions.includes("accounts:budget:update");

  return (
    <BudgetDetail
      budget={budget}
      lines={lines}
      accounts={allAccounts}
      canUpdate={canUpdate}
    />
  );
}
