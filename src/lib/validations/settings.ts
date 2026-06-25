import { z } from "zod";

export const TAX_TYPES = ["gst", "vat", "withholding", "other"] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  gst: "GST",
  vat: "VAT",
  withholding: "Withholding",
  other: "Other",
};

export const taxRateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100),
  rate: z.number().min(0, "Rate must be 0 or greater").max(100, "Rate cannot exceed 100%"),
  type: z.enum(TAX_TYPES, { message: "Select a valid tax type" }),
});

export type TaxRateFormValues = z.infer<typeof taxRateSchema>;

export const DOC_TYPES = [
  "invoice",
  "po",
  "grn",
  "work_order",
  "quotation",
  "trip",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  invoice: "Invoice",
  po: "Purchase Order",
  grn: "Goods Receipt Note",
  work_order: "Work Order",
  quotation: "Quotation",
  trip: "Trip",
};

export const RESET_CYCLE_LABELS: Record<string, string> = {
  never: "Never",
  yearly: "Yearly",
  monthly: "Monthly",
};

export const numberSeriesSchema = z.object({
  docType: z.string().min(1),
  prefix: z.string().max(20),
  padding: z.number().int().min(1, "Min 1 digit").max(10, "Max 10 digits"),
  nextNumber: z.number().int().min(1, "Must be at least 1"),
  resetCycle: z.enum(["never", "yearly", "monthly"], {
    message: "Select a reset cycle",
  }),
});

export type NumberSeriesFormValues = z.infer<typeof numberSeriesSchema>;
