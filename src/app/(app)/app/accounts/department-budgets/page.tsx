import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { budgets, budgetLines, accounts, departments } from "@/lib/db/schema";
import { DepartmentBudgets } from "@/components/app/accounts/department-budgets";

export default async function DepartmentBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try { user = await verifyAccessToken(token); }
  catch { redirect("/api/auth/refresh?next=/app/accounts/department-budgets"); }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const sp = await searchParams;
  const tid = user.tenant_id;

  const allBudgets = await db
    .select({ id: budgets.id, name: budgets.name, fiscalYear: budgets.fiscalYear, status: budgets.status })
    .from(budgets)
    .where(eq(budgets.tenantId, tid))
    .orderBy(budgets.fiscalYear);

  const selectedBudgetId = sp.budget ?? allBudgets.find((b) => b.status === "active")?.id ?? allBudgets[0]?.id;

  if (!selectedBudgetId) {
    return <DepartmentBudgets rows={[]} budgets={allBudgets} selectedBudgetId="" />;
  }

  // All budget lines for this budget that have a department
  const lines = await db
    .select({
      departmentId: budgetLines.departmentId,
      accountId: budgetLines.accountId,
      amount: budgetLines.amount,
    })
    .from(budgetLines)
    .where(and(eq(budgetLines.budgetId, selectedBudgetId), eq(budgetLines.tenantId, tid)));

  // Load departments
  const allDepts = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.tenantId, tid));

  // Load accounts
  const allAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
    .from(accounts)
    .where(eq(accounts.tenantId, tid));

  const deptMap = new Map(allDepts.map((d) => [d.id, d.name]));
  const acctMap = new Map(allAccounts.map((a) => [a.id, { code: a.code, name: a.name, type: a.type }]));

  // Group lines by department → accountId → total
  type DeptRow = {
    departmentId: string;
    departmentName: string;
    total: number;
    lineCount: number;
  };

  const deptTotals = new Map<string, { total: number; lineCount: number }>();
  const NO_DEPT = "__none__";

  for (const line of lines) {
    const key = line.departmentId ?? NO_DEPT;
    const prev = deptTotals.get(key) ?? { total: 0, lineCount: 0 };
    deptTotals.set(key, { total: prev.total + parseFloat(line.amount ?? "0"), lineCount: prev.lineCount + 1 });
  }

  const rows: DeptRow[] = [];
  for (const [deptId, data] of deptTotals) {
    rows.push({
      departmentId: deptId,
      departmentName: deptId === NO_DEPT ? "(No Department)" : (deptMap.get(deptId) ?? deptId),
      total: data.total,
      lineCount: data.lineCount,
    });
  }
  rows.sort((a, b) => a.departmentName.localeCompare(b.departmentName));

  return <DepartmentBudgets rows={rows} budgets={allBudgets} selectedBudgetId={selectedBudgetId} />;
}
