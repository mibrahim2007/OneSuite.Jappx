import { z } from "zod";

export const billLineSchema = z.object({
  accountId: z.string().uuid("Select an expense account"),
  description: z.string().max(200).optional().or(z.literal("")),
  amount: z.number().positive("Amount must be greater than 0"),
  taxRateId: z.string().uuid().optional().or(z.literal("")),
});

export const saveBillSchema = z
  .object({
    vendorId: z.string().uuid("Select a vendor"),
    billDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Bill date must be YYYY-MM-DD"),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"),
    periodId: z.string().uuid("Select a fiscal period"),
    reference: z.string().max(200).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
    payableAccountId: z.string().uuid("Select the AP payable account"),
    lines: z.array(billLineSchema).min(1, "At least one line item is required"),
  })
  .refine((d) => d.dueDate >= d.billDate, {
    message: "Due date must be on or after bill date",
    path: ["dueDate"],
  });

export type SaveBillValues = z.infer<typeof saveBillSchema>;
export type BillLineValues = z.infer<typeof billLineSchema>;
