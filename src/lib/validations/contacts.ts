import { z } from "zod";

export const CONTACT_TYPES = ["vendor", "customer", "both"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  vendor: "Vendor",
  customer: "Customer",
  both: "Both",
};

export const contactSchema = z.object({
  type: z.enum(CONTACT_TYPES, { message: "Select a contact type." }),
  name: z.string().min(1, "Name is required.").max(200),
  code: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email address.").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
});

export type ContactValues = z.infer<typeof contactSchema>;
