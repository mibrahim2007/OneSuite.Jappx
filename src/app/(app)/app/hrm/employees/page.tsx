import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { employees, departments, designations } from "@/lib/db/schema";
import { EmployeesTable } from "@/components/app/hrm/employees-table";

export default async function EmployeesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/employees");
  }

  const permError = requirePermission("hrm:employee:view", user);
  if (permError) redirect("/app/dashboard");

  const canCreate = !requirePermission("hrm:employee:create", user);
  const canEdit = !requirePermission("hrm:employee:update", user);
  const tid = user.tenant_id;

  const [empRows, deptRows, desigRows] = await Promise.all([
    db
      .select({
        id: employees.id,
        empCode: employees.empCode,
        fullName: employees.fullName,
        email: employees.email,
        phone: employees.phone,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
        managerId: employees.managerId,
        joinDate: employees.joinDate,
        status: employees.status,
        cnic: employees.cnic,
        departmentName: departments.name,
        designationTitle: designations.title,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(eq(employees.tenantId, tid))
      .orderBy(asc(employees.empCode)),
    db.select().from(departments).where(eq(departments.tenantId, tid)).orderBy(asc(departments.name)),
    db.select().from(designations).where(eq(designations.tenantId, tid)).orderBy(asc(designations.title)),
  ]);

  return (
    <EmployeesTable
      employees={empRows}
      departments={deptRows}
      designations={desigRows}
      canCreate={canCreate}
      canEdit={canEdit}
    />
  );
}
