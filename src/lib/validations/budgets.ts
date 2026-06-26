import { z } from "zod";

export const budgetSchema = z.object({
  name: z.string().min(1, "Name is required.").max(200),
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-YY (e.g. 2026-27)."),
  notes: z.string().max(500).optional().nullable(),
});

export const budgetLineSchema = z.object({
  accountId: z.string().uuid("Select an account."),
  departmentId: z.string().uuid().optional().nullable(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month."),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount."),
});

export const bulkBudgetLinesSchema = z.object({
  budgetId: z.string().uuid(),
  lines: z.array(budgetLineSchema).min(1, "At least one line is required."),
});

export type BudgetValues = z.infer<typeof budgetSchema>;
export type BudgetLineValues = z.infer<typeof budgetLineSchema>;
