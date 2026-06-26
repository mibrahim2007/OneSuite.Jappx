import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { payslips, payrollRuns, employees } from "@/lib/db/schema";
import { MyPayslipsView } from "@/components/app/hrm/my-payslips-view";

export default async function MyPayslipsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/payroll/my-payslips");
  }

  const permError = requirePermission("hrm:payslip:view", user);
  if (permError) redirect("/app/dashboard");

  const tid = user.tenant_id;

  // Find the employee record linked to the current user
  const [emp] = await db
    .select({ id: employees.id, fullName: employees.fullName, empCode: employees.empCode })
    .from(employees)
    .where(and(eq(employees.tenantId, tid), eq(employees.userId, user.sub)))
    .limit(1);

  if (!emp) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No employee record linked to your account. Contact HR.
      </div>
    );
  }

  const slipRows = await db
    .select({
      id: payslips.id,
      basic: payslips.basic,
      allowances: payslips.allowances,
      deductions: payslips.deductions,
      tax: payslips.tax,
      gross: payslips.gross,
      net: payslips.net,
      periodMonth: payrollRuns.periodMonth,
      runStatus: payrollRuns.status,
    })
    .from(payslips)
    .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
    .where(and(eq(payslips.employeeId, emp.id), eq(payslips.tenantId, tid)))
    .orderBy(desc(payrollRuns.periodMonth));

  return <MyPayslipsView employee={emp} payslips={slipRows} />;
}
