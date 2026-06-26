"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { jobPostings, jobApplications, interviews, employees } from "@/lib/db/schema";
import {
  jobPostingSchema, jobApplicationSchema, interviewSchema, interviewDecisionSchema,
} from "@/lib/validations/hrm";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type AS = { success: true } | { success: false; error: string } | null;

// --- Job Postings ---

export async function createJobPostingAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:recruit:create", user);
  if (err) return err;

  const parsed = jobPostingSchema.safeParse({
    title: (fd.get("title") as string)?.trim(),
    departmentId: (fd.get("departmentId") as string) || null,
    designationId: (fd.get("designationId") as string) || null,
    type: fd.get("type") as string,
    positionsCount: (fd.get("positionsCount") as string) || "1",
    description: (fd.get("description") as string)?.trim() || null,
    requirements: (fd.get("requirements") as string)?.trim() || null,
    status: (fd.get("status") as string) || "draft",
    postedDate: (fd.get("postedDate") as string) || null,
    closingDate: (fd.get("closingDate") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(jobPostings).values({ tenantId: user.tenant_id, ...parsed.data });
    });
  } catch { return { success: false, error: "Failed to create job posting." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "job_posting", action: "create" }); } catch {}
  revalidatePath("/app/hrm/recruitment/jobs");
  return { success: true };
}

export async function updateJobPostingAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:recruit:update", user);
  if (err) return err;

  const id = fd.get("id") as string;
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid posting ID." };

  const parsed = jobPostingSchema.safeParse({
    title: (fd.get("title") as string)?.trim(),
    departmentId: (fd.get("departmentId") as string) || null,
    designationId: (fd.get("designationId") as string) || null,
    type: fd.get("type") as string,
    positionsCount: (fd.get("positionsCount") as string) || "1",
    description: (fd.get("description") as string)?.trim() || null,
    requirements: (fd.get("requirements") as string)?.trim() || null,
    status: (fd.get("status") as string) || "draft",
    postedDate: (fd.get("postedDate") as string) || null,
    closingDate: (fd.get("closingDate") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(jobPostings).set(parsed.data)
        .where(and(eq(jobPostings.id, id), eq(jobPostings.tenantId, user.tenant_id)));
    });
  } catch { return { success: false, error: "Failed to update job posting." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "job_posting", entityId: id, action: "update" }); } catch {}
  revalidatePath("/app/hrm/recruitment/jobs");
  return { success: true };
}

// --- Job Applications ---

export async function createApplicationAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:recruit:update", user);
  if (err) return err;

  const parsed = jobApplicationSchema.safeParse({
    jobId: fd.get("jobId") as string,
    applicantName: (fd.get("applicantName") as string)?.trim(),
    email: (fd.get("email") as string)?.trim() || null,
    phone: (fd.get("phone") as string)?.trim() || null,
    resumeUrl: (fd.get("resumeUrl") as string)?.trim() || null,
    coverLetter: (fd.get("coverLetter") as string)?.trim() || null,
    source: (fd.get("source") as string) || "other",
    appliedDate: fd.get("appliedDate") as string,
    notes: (fd.get("notes") as string)?.trim() || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(jobApplications).values({ tenantId: user.tenant_id, ...parsed.data });
    });
  } catch { return { success: false, error: "Failed to add application." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "job_application", action: "create" }); } catch {}
  revalidatePath("/app/hrm/recruitment/jobs");
  return { success: true };
}

export async function updateApplicationStatusAction(
  applicationId: string,
  status: string
): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:recruit:update", user);
  if (err) return err;
  if (!UUID_RE.test(applicationId)) return { success: false, error: "Invalid application ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(jobApplications)
        .set({ status: status as "received" | "screening" | "interview" | "offer" | "hired" | "rejected" })
        .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.tenantId, user.tenant_id)));
    });
  } catch { return { success: false, error: "Failed to update application." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "job_application", entityId: applicationId, action: `status:${status}` }); } catch {}
  revalidatePath("/app/hrm/recruitment/jobs");
  return { success: true };
}

export async function convertToEmployeeAction(applicationId: string): Promise<{ success: false; error: string } | { success: true; employeeId: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:employee:create", user);
  if (err) return { success: false, error: err.error };
  if (!UUID_RE.test(applicationId)) return { success: false, error: "Invalid application ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let employeeId = "";
  try {
    employeeId = await withTenantRLS(ctx, async (tx) => {
      const [app] = await tx.select().from(jobApplications)
        .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.tenantId, user.tenant_id)))
        .limit(1);
      if (!app) throw new Error("Application not found.");

      const empCount = await tx.$count(employees, eq(employees.tenantId, user.tenant_id));
      const empCode = `EMP-${String(empCount + 1).padStart(4, "0")}`;

      const [emp] = await tx.insert(employees).values({
        tenantId: user.tenant_id,
        empCode,
        fullName: app.applicantName,
        email: app.email ?? undefined,
        phone: app.phone ?? undefined,
        status: "active",
      }).returning({ id: employees.id });

      await tx.update(jobApplications).set({ status: "hired" })
        .where(eq(jobApplications.id, applicationId));

      return emp!.id;
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to convert applicant." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "employee", entityId: employeeId, action: "create_from_application" }); } catch {}
  revalidatePath("/app/hrm/employees");
  revalidatePath("/app/hrm/recruitment/jobs");
  return { success: true, employeeId };
}

// --- Interviews ---

export async function createInterviewAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:recruit:update", user);
  if (err) return err;

  const parsed = interviewSchema.safeParse({
    applicationId: fd.get("applicationId") as string,
    interviewerId: (fd.get("interviewerId") as string) || null,
    scheduledDate: fd.get("scheduledDate") as string,
    scheduledTime: (fd.get("scheduledTime") as string) || null,
    type: (fd.get("type") as string) || "in_person",
    notes: (fd.get("notes") as string)?.trim() || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(interviews).values({ tenantId: user.tenant_id, ...parsed.data });
      await tx.update(jobApplications).set({ status: "interview" })
        .where(and(eq(jobApplications.id, parsed.data.applicationId), eq(jobApplications.tenantId, user.tenant_id)));
    });
  } catch { return { success: false, error: "Failed to schedule interview." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "interview", action: "create" }); } catch {}
  revalidatePath("/app/hrm/recruitment/interviews");
  revalidatePath("/app/hrm/recruitment/jobs");
  return { success: true };
}

export async function decideInterviewAction(_prev: AS, fd: FormData): Promise<AS> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const err = requirePermission("hrm:recruit:update", user);
  if (err) return err;

  const id = fd.get("id") as string;
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid interview ID." };

  const parsed = interviewDecisionSchema.safeParse({
    status: fd.get("status") as string,
    feedback: (fd.get("feedback") as string)?.trim() || null,
    rating: (fd.get("rating") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(interviews).set({
        status: parsed.data.status,
        feedback: parsed.data.feedback ?? null,
        rating: parsed.data.rating ?? null,
      }).where(and(eq(interviews.id, id), eq(interviews.tenantId, user.tenant_id)));
    });
  } catch { return { success: false, error: "Failed to update interview." }; }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "interview", entityId: id, action: parsed.data.status }); } catch {}
  revalidatePath("/app/hrm/recruitment/interviews");
  return { success: true };
}
