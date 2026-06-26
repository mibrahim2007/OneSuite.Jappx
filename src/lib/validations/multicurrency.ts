"use server";
import { z } from "zod";

export const currencySchema = z.object({
  code: z.string().length(3, "Currency code must be 3 characters.").toUpperCase(),
  name: z.string().min(1, "Name is required.").max(100),
  symbol: z.string().max(5).default(""),
  isBase: z.boolean().default(false),
});

export const exchangeRateSchema = z.object({
  fromCurrency: z.string().length(3).toUpperCase(),
  toCurrency: z.string().length(3).toUpperCase(),
  rate: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Invalid rate.")
    .refine((v) => parseFloat(v) > 0, "Rate must be greater than 0."),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  source: z.string().default("manual"),
});

export const bankStatementSchema = z.object({
  accountId: z.string().uuid("Select a bank account."),
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  openingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Invalid amount."),
  closingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Invalid amount."),
});

export const bankStatementLineSchema = z.object({
  statementId: z.string().uuid(),
  lineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  description: z.string().max(200).optional().nullable(),
  debit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount.").default("0"),
  credit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount.").default("0"),
  reference: z.string().max(100).optional().nullable(),
});
