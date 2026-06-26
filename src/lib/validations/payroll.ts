import { z } from "zod";

export const salaryComponentSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
});

export const salaryStructureSchema = z.object({
  employeeId: z.string().uuid("Select an employee."),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  basic: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount."),
  allowances: z.string().optional(),
  deductions: z.string().optional(),
});

export const payrollRunSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid period."),
});

export const postPayrollSchema = z.object({
  runId: z.string().uuid(),
  salaryExpenseAccountId: z.string().uuid("Select salary expense account."),
  payableAccountId: z.string().uuid("Select payable account."),
});
