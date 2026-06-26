import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { employees, salaryStructures } from "@/lib/db/schema";
import { SalaryStructuresView } from "@/components/app/hrm/salary-structures-view";

export default async function SalaryStructuresPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/payroll/structures");
  }

  const permError = requirePermission("hrm:payroll:view", user);
  if (permError) redirect("/app/dashboard");

  const canManage = !requirePermission("hrm:payroll:run", user);
  const tid = user.tenant_id;

  const [empRows, structRows] = await Promise.all([
    db
      .select({ id: employees.id, fullName: employees.fullName, empCode: employees.empCode })
      .from(employees)
      .where(eq(employees.tenantId, tid))
      .orderBy(asc(employees.fullName)),
    db
      .select({
        id: salaryStructures.id,
        employeeId: salaryStructures.employeeId,
        effectiveFrom: salaryStructures.effectiveFrom,
        basic: salaryStructures.basic,
        allowances: salaryStructures.allowances,
        deductions: salaryStructures.deductions,
        gross: salaryStructures.gross,
      })
      .from(salaryStructures)
      .where(eq(salaryStructures.tenantId, tid))
      .orderBy(asc(salaryStructures.effectiveFrom)),
  ]);

  return (
    <SalaryStructuresView
      employees={empRows}
      structures={structRows}
      canManage={canManage}
    />
  );
}
