import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  parentId: z.string().uuid("Invalid parent category.").optional().nullable(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const uomSchema = z.object({
  code: z.string().min(1, "Code is required.").max(20),
  name: z.string().min(1, "Name is required.").max(100),
});

export type UomFormValues = z.infer<typeof uomSchema>;

export const VALUATION_METHODS = ["fifo", "weighted_average", "standard"] as const;
export const VALUATION_METHOD_LABELS: Record<string, string> = {
  fifo: "FIFO",
  weighted_average: "Weighted Average",
  standard: "Standard Cost",
};

export const itemSchema = z.object({
  sku: z.string().min(1, "SKU is required.").max(100),
  name: z.string().min(1, "Name is required.").max(200),
  categoryId: z.string().uuid("Invalid category.").optional().nullable(),
  uomId: z.string().uuid("Invalid UoM.").optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  isStock: z.boolean().default(true),
  valuation: z.enum(["fifo", "weighted_average", "standard"]).default("weighted_average"),
  purchasePrice: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid price.")
    .optional()
    .nullable(),
  salePrice: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid price.")
    .optional()
    .nullable(),
  reorderLevel: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid quantity.")
    .optional()
    .nullable(),
  inventoryAccountId: z.string().uuid("Invalid account.").optional().nullable(),
});

export const updateItemSchema = itemSchema.extend({});

export type ItemFormValues = z.infer<typeof itemSchema>;

export const warehouseSchema = z.object({
  code: z.string().min(1, "Code is required.").max(20),
  name: z.string().min(1, "Name is required.").max(100),
  location: z.string().max(200).optional().nullable(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  location: z.string().max(200).optional().nullable(),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

// --- Stock Moves ---

export const MOVE_TYPES = ["receipt", "issue", "transfer", "adjustment", "return"] as const;
export type MoveType = typeof MOVE_TYPES[number];

export const MOVE_TYPE_LABELS: Record<MoveType, string> = {
  receipt: "Receipt",
  issue: "Issue",
  transfer: "Transfer",
  adjustment: "Adjustment",
  return: "Return",
};

export const stockMoveSchema = z
  .object({
    moveType: z.enum(MOVE_TYPES, { error: "Move type is required." }),
    itemId: z.string().uuid("Select an item."),
    warehouseId: z.string().uuid("Select a warehouse."),
    toWarehouseId: z.string().uuid("Select destination warehouse.").optional().nullable(),
    quantity: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, "Quantity must be a positive number.")
      .refine((v) => parseFloat(v) > 0, "Quantity must be greater than 0."),
    unitCost: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, "Invalid cost.")
      .optional()
      .nullable(),
    reference: z.string().max(100).optional().nullable(),
    moveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  })
  .superRefine((data, ctx) => {
    if (data.moveType === "transfer") {
      if (!data.toWarehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["toWarehouseId"],
          message: "Destination warehouse is required for transfers.",
        });
      } else if (data.toWarehouseId === data.warehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["toWarehouseId"],
          message: "Source and destination warehouse must differ.",
        });
      }
    }
  });

export type StockMoveFormValues = z.infer<typeof stockMoveSchema>;
