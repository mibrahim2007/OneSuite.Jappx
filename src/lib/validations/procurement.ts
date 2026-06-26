import { z } from "zod";

export const REQUISITION_STATUSES = ["draft", "submitted", "approved", "rejected", "converted"] as const;
export const PO_STATUSES = ["draft", "submitted", "approved", "partial", "received", "closed", "cancelled"] as const;
export const GRN_STATUSES = ["draft", "posted", "cancelled"] as const;

export const requisitionLineSchema = z.object({
  itemId: z.string().uuid("Select an item."),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Positive number required.")
    .refine((v) => parseFloat(v) > 0, "Quantity must be > 0."),
});

export const requisitionSchema = z.object({
  reqNo: z.string().min(1, "Req No is required.").max(50),
  reqDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(requisitionLineSchema).min(1, "At least one line is required."),
});

export const poLineSchema = z.object({
  itemId: z.string().uuid("Select an item."),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Positive number required.")
    .refine((v) => parseFloat(v) > 0, "Quantity must be > 0."),
  unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid price."),
  taxRateId: z.string().uuid().optional().nullable(),
});

export const purchaseOrderSchema = z.object({
  poNo: z.string().min(1, "PO No is required.").max(50),
  vendorId: z.string().uuid("Select a vendor."),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  fromReqId: z.string().uuid().optional().nullable(),
  lines: z.array(poLineSchema).min(1, "At least one line is required."),
});

export const grnLineSchema = z.object({
  itemId: z.string().uuid("Select an item."),
  poLineId: z.string().uuid().optional().nullable(),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Positive number required.")
    .refine((v) => parseFloat(v) > 0, "Quantity must be > 0."),
  unitCost: z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid cost."),
});

export const grnSchema = z.object({
  grnNo: z.string().min(1, "GRN No is required.").max(50),
  poId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid("Select a warehouse."),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  lines: z.array(grnLineSchema).min(1, "At least one line is required."),
});

export type RequisitionLineValues = z.infer<typeof requisitionLineSchema>;
export type RequisitionFormValues = z.infer<typeof requisitionSchema>;
export type PoLineValues = z.infer<typeof poLineSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
export type GrnLineValues = z.infer<typeof grnLineSchema>;
export type GrnFormValues = z.infer<typeof grnSchema>;
