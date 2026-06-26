import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import type { Route } from "next";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { jobPostings, jobApplications, interviews, employees } from "@/lib/db/schema";
import JobDetailView from "@/components/app/hrm/job-detail-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  let user;
  try { user = await verifyAccessToken(token); } catch { redirect(`/api/auth/refresh?next=/app/hrm/recruitment/jobs/${id}`); }
  const permError = requirePermission("hrm:recruit:view", user);
  if (permError) redirect("/app/dashboard");
  if (!UUID_RE.test(id)) redirect("/app/hrm/recruitment/jobs" as Route);

  const tid = user.tenant_id;
  const [[job], applications, interviewRows, emps] = await Promise.all([
    db.select().from(jobPostings)
      .where(and(eq(jobPostings.id, id), eq(jobPostings.tenantId, tid)))
      .limit(1),
    db.select().from(jobApplications)
      .where(and(eq(jobApplications.jobId, id), eq(jobApplications.tenantId, tid)))
      .orderBy(jobApplications.createdAt),
    db.select().from(interviews)
      .where(eq(interviews.tenantId, tid))
      .orderBy(interviews.scheduledDate),
    db.select({ id: employees.id, fullName: employees.fullName }).from(employees).where(eq(employees.tenantId, tid)),
  ]);

  if (!job) redirect("/app/hrm/recruitment/jobs" as Route);

  const canUpdate = !requirePermission("hrm:recruit:update", user);

  return (
    <JobDetailView
      job={job}
      applications={applications}
      interviews={interviewRows}
      employees={emps}
      canUpdate={canUpdate}
    />
  );
}
