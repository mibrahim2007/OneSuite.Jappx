import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { payrollRuns } from "@/lib/db/schema";
import { PayrollRunsTable } from "@/components/app/hrm/payroll-runs-table";

export default async function PayrollRunsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/payroll/runs");
  }

  const permError = requirePermission("hrm:payroll:view", user);
  if (permError) redirect("/app/dashboard");

  const canRun = !requirePermission("hrm:payroll:run", user);
  const tid = user.tenant_id;

  const runs = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.tenantId, tid))
    .orderBy(desc(payrollRuns.periodMonth));

  return <PayrollRunsTable runs={runs} canRun={canRun} />;
}
