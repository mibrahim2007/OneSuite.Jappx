import { z } from "zod";

export const invoiceLineSchema = z.object({
  accountId: z.string().uuid("Select an income account"),
  description: z.string().max(200).optional().or(z.literal("")),
  amount: z.number().positive("Amount must be greater than 0"),
  taxRateId: z.string().uuid().optional().or(z.literal("")),
});

export const saveInvoiceSchema = z
  .object({
    customerId: z.string().uuid("Select a customer"),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date must be YYYY-MM-DD"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"),
    periodId: z.string().uuid("Select a fiscal period"),
    reference: z.string().max(200).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
    receivableAccountId: z.string().uuid("Select the AR receivable account"),
    lines: z.array(invoiceLineSchema).min(1, "At least one line item is required"),
  })
  .refine((d) => d.dueDate >= d.invoiceDate, {
    message: "Due date must be on or after invoice date",
    path: ["dueDate"],
  });

export type SaveInvoiceValues = z.infer<typeof saveInvoiceSchema>;
export type InvoiceLineValues = z.infer<typeof invoiceLineSchema>;
