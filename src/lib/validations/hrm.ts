import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  parentId: z.string().uuid("Invalid parent.").optional().nullable(),
});

export const designationSchema = z.object({
  title: z.string().min(1, "Title is required.").max(100),
});

export const EMPLOYMENT_STATUSES = [
  "active",
  "probation",
  "on_leave",
  "resigned",
  "terminated",
] as const;

export const employeeSchema = z.object({
  empCode: z.string().min(1, "Employee code is required.").max(50),
  fullName: z.string().min(1, "Full name is required.").max(200),
  email: z.string().email("Invalid email.").optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  designationId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.").optional().nullable(),
  status: z.enum(EMPLOYMENT_STATUSES).default("active"),
  cnic: z.string().max(20).optional().nullable(),
});

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "leave",
  "half_day",
  "holiday",
  "weekend",
] as const;

export const attendanceSchema = z.object({
  employeeId: z.string().uuid("Select an employee."),
  attDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  status: z.enum(ATTENDANCE_STATUSES).default("present"),
  workedHours: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
});

export const leaveTypeSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  annualQuota: z.string().regex(/^\d+(\.\d)?$/, "Invalid quota.").default("0"),
  isPaid: z.boolean().default(true),
});

export const leaveRequestSchema = z.object({
  employeeId: z.string().uuid("Select an employee."),
  leaveTypeId: z.string().uuid("Select a leave type.").optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date."),
  days: z.string().regex(/^\d+(\.\d)?$/, "Invalid days."),
  reason: z.string().max(500).optional().nullable(),
});

// --- Recruitment ---
export const JOB_TYPES = ["full_time", "part_time", "contract", "intern"] as const;
export const JOB_STATUSES = ["draft", "open", "closed", "cancelled"] as const;
export const APPLICATION_STATUSES = ["received", "screening", "interview", "offer", "hired", "rejected"] as const;
export const APPLICATION_SOURCES = ["linkedin", "indeed", "referral", "walk_in", "website", "other"] as const;
export const INTERVIEW_TYPES = ["phone", "video", "in_person"] as const;
export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;

export const jobPostingSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  departmentId: z.string().uuid().optional().nullable(),
  designationId: z.string().uuid().optional().nullable(),
  type: z.enum(JOB_TYPES).default("full_time"),
  positionsCount: z.string().regex(/^\d+$/).default("1"),
  description: z.string().max(5000).optional().nullable(),
  requirements: z.string().max(5000).optional().nullable(),
  status: z.enum(JOB_STATUSES).default("draft"),
  postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const jobApplicationSchema = z.object({
  jobId: z.string().uuid("Select a job."),
  applicantName: z.string().min(1, "Applicant name is required.").max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  resumeUrl: z.string().max(500).optional().nullable(),
  coverLetter: z.string().max(5000).optional().nullable(),
  source: z.enum(APPLICATION_SOURCES).default("other"),
  appliedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  notes: z.string().max(1000).optional().nullable(),
});

export const interviewSchema = z.object({
  applicationId: z.string().uuid("Select an application."),
  interviewerId: z.string().uuid().optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  scheduledTime: z.string().max(10).optional().nullable(),
  type: z.enum(INTERVIEW_TYPES).default("in_person"),
  notes: z.string().max(1000).optional().nullable(),
});

export const interviewDecisionSchema = z.object({
  status: z.enum(["completed", "cancelled", "no_show"]),
  feedback: z.string().max(2000).optional().nullable(),
  rating: z.string().regex(/^[1-5]$/).optional().nullable(),
});

// --- Appraisals ---
export const APPRAISAL_CYCLE_STATUSES = ["draft", "active", "closed"] as const;
export const APPRAISAL_STATUSES = ["pending", "self_review", "manager_review", "completed"] as const;

export const appraisalCycleSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date."),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date."),
  status: z.enum(APPRAISAL_CYCLE_STATUSES).default("draft"),
});

export const appraisalKpiSchema = z.object({
  kpiName: z.string().min(1, "KPI name is required.").max(200),
  target: z.string().max(500).optional().nullable(),
  actual: z.string().max(500).optional().nullable(),
  weight: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  rating: z.string().regex(/^[1-5]$/).optional().nullable(),
  comments: z.string().max(1000).optional().nullable(),
});
