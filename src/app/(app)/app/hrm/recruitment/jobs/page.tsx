import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { jobPostings, departments, designations } from "@/lib/db/schema";
import JobsView from "@/components/app/hrm/jobs-view";

export default async function JobsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  let user;
  try { user = await verifyAccessToken(token); } catch { redirect("/api/auth/refresh?next=/app/hrm/recruitment/jobs"); }
  const permError = requirePermission("hrm:recruit:view", user);
  if (permError) redirect("/app/dashboard");

  const tid = user.tenant_id;
  const [jobs, depts, desigs] = await Promise.all([
    db.select().from(jobPostings).where(eq(jobPostings.tenantId, tid)).orderBy(jobPostings.createdAt),
    db.select().from(departments).where(eq(departments.tenantId, tid)),
    db.select().from(designations).where(eq(designations.tenantId, tid)),
  ]);

  const canCreate = !requirePermission("hrm:recruit:create", user);
  const canUpdate = !requirePermission("hrm:recruit:update", user);

  return (
    <JobsView
      jobs={jobs}
      departments={depts}
      designations={desigs}
      canCreate={canCreate}
      canUpdate={canUpdate}
    />
  );
}
