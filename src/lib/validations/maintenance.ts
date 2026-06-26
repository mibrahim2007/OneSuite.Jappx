import { z } from "zod";

export const assetSchema = z.object({
  code: z.string().min(1, "Code is required.").max(50),
  name: z.string().min(1, "Name is required.").max(200),
  category: z.string().max(100).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  purchaseCost: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid cost.")
    .optional()
    .nullable(),
  warrantyExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  meterReading: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid meter reading.")
    .optional()
    .nullable(),
  status: z.enum(["active", "inactive", "disposed"]).default("active"),
});

export const workOrderSchema = z.object({
  assetId: z.string().uuid().optional().nullable(),
  type: z.enum(["corrective", "preventive", "inspection"]).default("corrective"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  title: z.string().min(1, "Title is required.").max(200),
  description: z.string().max(2000).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  laborHours: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid hours.")
    .optional()
    .nullable(),
  laborCost: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid cost.")
    .optional()
    .nullable(),
});

export const pmScheduleSchema = z.object({
  assetId: z.string().uuid("Select an asset."),
  name: z.string().min(1, "Name is required.").max(200),
  basis: z.enum(["time", "meter"]).default("time"),
  intervalDays: z.coerce.number().int().positive().optional().nullable(),
  intervalMeter: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid meter interval.")
    .optional()
    .nullable(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const woTaskSchema = z.object({
  workOrderId: z.string().uuid(),
  description: z.string().min(1, "Task description is required.").max(500),
});

export const woPartSchema = z.object({
  workOrderId: z.string().uuid(),
  itemId: z.string().uuid("Select an item."),
  warehouseId: z.string().uuid().optional().nullable(),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid quantity.")
    .refine((v) => parseFloat(v) > 0, "Quantity must be > 0."),
  unitCost: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid unit cost.")
    .optional()
    .nullable(),
});

export type AssetFormValues = z.infer<typeof assetSchema>;
export type WorkOrderFormValues = z.infer<typeof workOrderSchema>;
export type PmScheduleFormValues = z.infer<typeof pmScheduleSchema>;
