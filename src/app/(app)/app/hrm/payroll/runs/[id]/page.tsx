import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { payrollRuns, payslips, employees, accounts } from "@/lib/db/schema";
import { PayrollRunDetail } from "@/components/app/hrm/payroll-run-detail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/app/hrm/payroll/runs/${id}`);
  }

  const permError = requirePermission("hrm:payroll:view", user);
  if (permError) redirect("/app/dashboard");

  if (!UUID_RE.test(id)) redirect("/app/hrm/payroll/runs" as never);

  const canRun = !requirePermission("hrm:payroll:run", user);
  const tid = user.tenant_id;

  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, tid)))
    .limit(1);

  if (!run) redirect("/app/hrm/payroll/runs" as never);

  const [slipRows, expenseAccounts] = await Promise.all([
    db
      .select({
        id: payslips.id,
        employeeId: payslips.employeeId,
        employeeName: employees.fullName,
        empCode: employees.empCode,
        basic: payslips.basic,
        allowances: payslips.allowances,
        deductions: payslips.deductions,
        tax: payslips.tax,
        gross: payslips.gross,
        net: payslips.net,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(and(eq(payslips.payrollRunId, id), eq(payslips.tenantId, tid))),
    db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.tenantId, tid), eq(accounts.isActive, true))),
  ]);

  return (
    <PayrollRunDetail
      run={run}
      payslips={slipRows}
      accounts={expenseAccounts}
      canRun={canRun}
    />
  );
}
