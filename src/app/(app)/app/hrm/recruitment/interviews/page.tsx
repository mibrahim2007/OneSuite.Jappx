import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { interviews, jobApplications, jobPostings, employees } from "@/lib/db/schema";
import InterviewsView from "@/components/app/hrm/interviews-view";

export default async function InterviewsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");
  let user;
  try { user = await verifyAccessToken(token); } catch { redirect("/api/auth/refresh?next=/app/hrm/recruitment/interviews"); }
  const permError = requirePermission("hrm:recruit:view", user);
  if (permError) redirect("/app/dashboard");

  const tid = user.tenant_id;
  const [rows, emps, apps, jobs] = await Promise.all([
    db.select().from(interviews).where(eq(interviews.tenantId, tid)).orderBy(interviews.scheduledDate),
    db.select({ id: employees.id, fullName: employees.fullName }).from(employees).where(eq(employees.tenantId, tid)),
    db.select({ id: jobApplications.id, applicantName: jobApplications.applicantName, jobId: jobApplications.jobId })
      .from(jobApplications).where(eq(jobApplications.tenantId, tid)),
    db.select({ id: jobPostings.id, title: jobPostings.title }).from(jobPostings).where(eq(jobPostings.tenantId, tid)),
  ]);

  const canUpdate = !requirePermission("hrm:recruit:update", user);

  return (
    <InterviewsView
      interviews={rows}
      employees={emps}
      applications={apps}
      jobPostings={jobs}
      canUpdate={canUpdate}
    />
  );
}
