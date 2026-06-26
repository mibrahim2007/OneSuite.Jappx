import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { departments, designations } from "@/lib/db/schema";
import { DepartmentsTable } from "@/components/app/hrm/departments-table";

export default async function DepartmentsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/hrm/departments");
  }

  const permError = requirePermission("hrm:employee:view", user);
  if (permError) redirect("/app/dashboard");

  const canEdit = !requirePermission("hrm:employee:create", user);
  const tid = user.tenant_id;

  const [deptRows, desigRows] = await Promise.all([
    db.select().from(departments).where(eq(departments.tenantId, tid)).orderBy(asc(departments.name)),
    db.select().from(designations).where(eq(designations.tenantId, tid)).orderBy(asc(designations.title)),
  ]);

  return (
    <DepartmentsTable
      departments={deptRows}
      designations={desigRows}
      canEdit={canEdit}
    />
  );
}
