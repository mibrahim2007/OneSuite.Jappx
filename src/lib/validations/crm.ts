import { z } from "zod";

export const crmCompanySchema = z.object({
  name: z.string().min(1, "Company name is required.").max(200),
  industry: z.string().max(100).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
});

export const crmContactSchema = z.object({
  companyId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(1, "Full name is required.").max(200),
  email: z.string().email("Invalid email.").max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
});

export const leadSchema = z.object({
  name: z.string().min(1, "Lead name is required.").max(200),
  company: z.string().max(200).optional().nullable(),
  email: z.string().email("Invalid email.").max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  score: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? parseInt(v, 10) : 0)),
});

export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const pipelineStageSchema = z.object({
  name: z.string().min(1, "Stage name is required.").max(100),
  sortOrder: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0)),
  winProbability: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0)),
});

export const opportunitySchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  stageId: z.string().uuid().optional().nullable(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid amount.")
    .optional()
    .nullable(),
  expectedClose: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
    .optional()
    .nullable(),
});

export const activitySchema = z.object({
  type: z.enum(["call", "meeting", "email", "task", "note"]),
  subject: z.string().min(1, "Subject is required.").max(200),
  notes: z.string().max(2000).optional().nullable(),
  relatedEntity: z.string().max(50).optional().nullable(),
  relatedId: z.string().uuid().optional().nullable(),
  dueAt: z.string().optional().nullable(),
});

export const quotationLineSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, "Description is required.").max(500),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Quantity must be a positive number.")
    .refine((v) => parseFloat(v) > 0, "Quantity must be > 0."),
  unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid price."),
});

export const saveQuotationSchema = z.object({
  opportunityId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
    .optional()
    .nullable(),
  lines: z.array(quotationLineSchema).min(1, "At least one line is required."),
});
