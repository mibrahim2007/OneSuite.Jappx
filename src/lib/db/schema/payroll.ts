import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

export const payrollStatusEnum = pgEnum("payroll_status", [
  "draft",
  "processing",
  "approved",
  "posted",
  "paid",
]);

export const salaryStructures = pgTable(
  "salary_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    basic: numeric("basic", { precision: 15, scale: 2 }).notNull().default("0"),
    allowances: jsonb("allowances")
      .$type<Array<{ name: string; amount: number }>>()
      .notNull()
      .default([]),
    deductions: jsonb("deductions")
      .$type<Array<{ name: string; amount: number }>>()
      .notNull()
      .default([]),
    gross: numeric("gross", { precision: 15, scale: 2 }).notNull().default("0"),
  },
  (t) => [unique("salary_structures_tenant_employee_uq").on(t.tenantId, t.employeeId)]
);

export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  periodMonth: text("period_month").notNull(),
  status: payrollStatusEnum("status").notNull().default("draft"),
  totalGross: numeric("total_gross", { precision: 15, scale: 2 }).default("0"),
  totalNet: numeric("total_net", { precision: 15, scale: 2 }).default("0"),
  journalId: uuid("journal_id"),
  processedBy: uuid("processed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payslips = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  payrollRunId: uuid("payroll_run_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
  basic: numeric("basic", { precision: 15, scale: 2 }).notNull().default("0"),
  allowances: numeric("allowances", { precision: 15, scale: 2 }).notNull().default("0"),
  deductions: numeric("deductions", { precision: 15, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
  gross: numeric("gross", { precision: 15, scale: 2 }).notNull().default("0"),
  net: numeric("net", { precision: 15, scale: 2 }).notNull().default("0"),
  pdfPath: text("pdf_path"),
});

export type SalaryStructure = typeof salaryStructures.$inferSelect;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
