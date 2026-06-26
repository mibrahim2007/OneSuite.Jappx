import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { employees, attendance } from "@/lib/db/schema";
import { AttendanceGrid } from "@/components/app/hrm/attendance-grid";

export default async function AttendancePage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/attendance");
  }

  const permError = requirePermission("hrm:attendance:view", user);
  if (permError) redirect("/app/dashboard");

  const canManage = !requirePermission("hrm:attendance:manage", user);
  const tid = user.tenant_id;

  const [empRows, attRows] = await Promise.all([
    db
      .select({ id: employees.id, empCode: employees.empCode, fullName: employees.fullName })
      .from(employees)
      .where(eq(employees.tenantId, tid))
      .orderBy(asc(employees.empCode)),
    db
      .select()
      .from(attendance)
      .where(eq(attendance.tenantId, tid))
      .orderBy(asc(attendance.attDate)),
  ]);

  return (
    <AttendanceGrid
      employees={empRows}
      attendanceRecords={attRows}
      canManage={canManage}
    />
  );
}
