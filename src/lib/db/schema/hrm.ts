import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

export const employmentStatusEnum = pgEnum("employment_status", [
  "active",
  "probation",
  "on_leave",
  "resigned",
  "terminated",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "leave",
  "half_day",
  "holiday",
  "weekend",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
});

export const designations = pgTable("designations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
});

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  empCode: text("emp_code").notNull(),
  userId: uuid("user_id"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  departmentId: uuid("department_id"),
  designationId: uuid("designation_id"),
  managerId: uuid("manager_id"),
  joinDate: text("join_date"),
  status: employmentStatusEnum("status").notNull().default("active"),
  cnic: text("cnic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull(),
  attDate: text("att_date").notNull(),
  checkIn: timestamp("check_in", { withTimezone: true }),
  checkOut: timestamp("check_out", { withTimezone: true }),
  status: attendanceStatusEnum("status").notNull().default("present"),
  workedHours: numeric("worked_hours", { precision: 5, scale: 2 }),
});

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  annualQuota: numeric("annual_quota", { precision: 5, scale: 1 }).default("0"),
  isPaid: boolean("is_paid").notNull().default(true),
});

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull(),
  leaveTypeId: uuid("leave_type_id"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: numeric("days", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Department = typeof departments.$inferSelect;
export type Designation = typeof designations.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;

// --- Recruitment ---

export const jobTypeEnum = pgEnum("job_type", [
  "full_time", "part_time", "contract", "intern",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft", "open", "closed", "cancelled",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "received", "screening", "interview", "offer", "hired", "rejected",
]);

export const applicationSourceEnum = pgEnum("application_source", [
  "linkedin", "indeed", "referral", "walk_in", "website", "other",
]);

export const interviewTypeEnum = pgEnum("interview_type", [
  "phone", "video", "in_person",
]);

export const interviewStatusEnum = pgEnum("interview_status", [
  "scheduled", "completed", "cancelled", "no_show",
]);

export const jobPostings = pgTable("job_postings", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title:          text("title").notNull(),
  departmentId:   uuid("department_id"),
  designationId:  uuid("designation_id"),
  type:           jobTypeEnum("type").notNull().default("full_time"),
  positionsCount: numeric("positions_count", { precision: 5, scale: 0 }).notNull().default("1"),
  description:    text("description"),
  requirements:   text("requirements"),
  status:         jobStatusEnum("status").notNull().default("draft"),
  postedDate:     text("posted_date"),
  closingDate:    text("closing_date"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobApplications = pgTable("job_applications", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  jobId:         uuid("job_id").notNull(),
  applicantName: text("applicant_name").notNull(),
  email:         text("email"),
  phone:         text("phone"),
  resumeUrl:     text("resume_url"),
  coverLetter:   text("cover_letter"),
  source:        applicationSourceEnum("source").notNull().default("other"),
  status:        applicationStatusEnum("status").notNull().default("received"),
  appliedDate:   text("applied_date").notNull(),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interviews = pgTable("interviews", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  interviewerId: uuid("interviewer_id"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  type:          interviewTypeEnum("type").notNull().default("in_person"),
  status:        interviewStatusEnum("status").notNull().default("scheduled"),
  feedback:      text("feedback"),
  rating:        numeric("rating", { precision: 2, scale: 0 }),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Appraisals ---

export const appraisalCycleStatusEnum = pgEnum("appraisal_cycle_status", [
  "draft", "active", "closed",
]);

export const appraisalStatusEnum = pgEnum("appraisal_status", [
  "pending", "self_review", "manager_review", "completed",
]);

export const appraisalCycles = pgTable("appraisal_cycles", {
  id:          uuid("id").primaryKey().defaultRandom(),
  tenantId:    uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd:   text("period_end").notNull(),
  status:      appraisalCycleStatusEnum("status").notNull().default("draft"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appraisals = pgTable("appraisals", {
  id:            uuid("id").primaryKey().defaultRandom(),
  tenantId:      uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  cycleId:       uuid("cycle_id").notNull(),
  employeeId:    uuid("employee_id").notNull(),
  reviewerId:    uuid("reviewer_id"),
  status:        appraisalStatusEnum("status").notNull().default("pending"),
  overallRating: numeric("overall_rating", { precision: 3, scale: 2 }),
  comments:      text("comments"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appraisalKpis = pgTable("appraisal_kpis", {
  id:          uuid("id").primaryKey().defaultRandom(),
  appraisalId: uuid("appraisal_id").notNull(),
  kpiName:     text("kpi_name").notNull(),
  target:      text("target"),
  actual:      text("actual"),
  weight:      numeric("weight", { precision: 5, scale: 2 }).default("0"),
  rating:      numeric("rating", { precision: 2, scale: 0 }),
  comments:    text("comments"),
});

export type JobPosting = typeof jobPostings.$inferSelect;
export type JobApplication = typeof jobApplications.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type AppraisalCycle = typeof appraisalCycles.$inferSelect;
export type Appraisal = typeof appraisals.$inferSelect;
export type AppraisalKpi = typeof appraisalKpis.$inferSelect;
