import { z } from "zod";

export const journalLineSchema = z
  .object({
    accountId: z.string().uuid("Select an account"),
    description: z.string().max(200).optional().or(z.literal("")),
    debit: z.number().min(0, "Must be ≥ 0"),
    credit: z.number().min(0, "Must be ≥ 0"),
  })
  .refine((data) => data.debit > 0 || data.credit > 0, {
    message: "Each line must have a non-zero debit or credit",
  });

export const postJournalSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Entry date must be in YYYY-MM-DD format"),
  periodId: z.string().uuid("Select a fiscal period"),
  reference: z.string().max(200).optional().or(z.literal("")),
  memo: z.string().max(500).optional().or(z.literal("")),
  lines: z.array(journalLineSchema).min(2, "At least 2 lines required"),
});

export type PostJournalValues = z.infer<typeof postJournalSchema>;
export type JournalLineValues = z.infer<typeof journalLineSchema>;
