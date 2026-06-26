import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "bank", "cheque", "card", "online", "adjustment"] as const;

export const createPaymentSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  billId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  partyId: z.string().uuid("Select a contact."),
  bankAccountId: z.string().uuid("Select a bank account."),
  method: z.enum(PAYMENT_METHODS).default("bank"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.").refine(
    (v) => parseFloat(v) > 0, "Amount must be greater than 0."
  ),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  reference: z.string().max(100).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.direction === "outbound" && !data.billId) {
    ctx.addIssue({ code: "custom", path: ["billId"], message: "Select a bill to pay." });
  }
  if (data.direction === "inbound" && !data.invoiceId) {
    ctx.addIssue({ code: "custom", path: ["invoiceId"], message: "Select an invoice to receive against." });
  }
});

export type CreatePaymentValues = z.infer<typeof createPaymentSchema>;
