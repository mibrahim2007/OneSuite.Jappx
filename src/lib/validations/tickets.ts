import { z } from "zod";

export const ticketSchema = z.object({
  subject: z.string().min(1, "Subject is required.").max(300),
  description: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "pending", "resolved", "closed"]),
  assignedTo: z.string().uuid().optional().nullable(),
  dueAt: z.string().optional().nullable(),
});

export type TicketFormValues = z.infer<typeof ticketSchema>;

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
