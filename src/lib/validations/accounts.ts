import { z } from "zod";

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export const accountFormSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(1, "Account code is required")
    .max(20, "Max 20 characters")
    .trim(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(150, "Max 150 characters")
    .trim(),
  type: z.enum(ACCOUNT_TYPES, { message: "Select a valid account type" }),
  groupId: z.string().optional(),
  currency: z.string().max(3, "Max 3 characters").optional(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const updateAccountSchema = accountFormSchema.omit({ code: true });
export type UpdateAccountFormValues = z.infer<typeof updateAccountSchema>;
