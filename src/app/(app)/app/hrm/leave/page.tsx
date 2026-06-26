import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { employees, leaveTypes, leaveRequests } from "@/lib/db/schema";
import { LeaveTable } from "@/components/app/hrm/leave-table";

export default async function LeavePage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/leave");
  }

  const permError = requirePermission("hrm:leave:view", user);
  if (permError) redirect("/app/dashboard");

  const canRequest = !requirePermission("hrm:leave:request", user);
  const canApprove = !requirePermission("hrm:leave:approve", user);
  const tid = user.tenant_id;

  const [empRows, ltRows, lrRows] = await Promise.all([
    db
      .select({ id: employees.id, empCode: employees.empCode, fullName: employees.fullName })
      .from(employees)
      .where(eq(employees.tenantId, tid))
      .orderBy(asc(employees.empCode)),
    db.select().from(leaveTypes).where(eq(leaveTypes.tenantId, tid)).orderBy(asc(leaveTypes.name)),
    db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        leaveTypeId: leaveRequests.leaveTypeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        days: leaveRequests.days,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approvedBy: leaveRequests.approvedBy,
        createdAt: leaveRequests.createdAt,
        employeeName: employees.fullName,
        leaveTypeName: leaveTypes.name,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(eq(leaveRequests.tenantId, tid))
      .orderBy(asc(leaveRequests.createdAt)),
  ]);

  return (
    <LeaveTable
      requests={lrRows}
      employees={empRows}
      leaveTypes={ltRows}
      canRequest={canRequest}
      canApprove={canApprove}
    />
  );
}
