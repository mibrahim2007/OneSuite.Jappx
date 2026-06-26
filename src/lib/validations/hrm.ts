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
