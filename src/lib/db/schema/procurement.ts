import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

export const requisitionStatusEnum = pgEnum("requisition_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "converted",
]);

export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "submitted",
  "approved",
  "partial",
  "received",
  "closed",
  "cancelled",
]);

export const grnStatusEnum = pgEnum("grn_status", [
  "draft",
  "posted",
  "cancelled",
]);

export const requisitions = pgTable("requisitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  reqNo: text("req_no").notNull(),
  requestedBy: uuid("requested_by"),
  reqDate: text("req_date").notNull(),
  status: requisitionStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
});

export const requisitionLines = pgTable("requisition_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  requisitionId: uuid("requisition_id").notNull(),
  itemId: uuid("item_id").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  poNo: text("po_no").notNull(),
  vendorId: uuid("vendor_id").notNull(),
  orderDate: text("order_date").notNull(),
  expectedDate: text("expected_date"),
  status: poStatusEnum("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 15, scale: 4 }).notNull().default("0"),
  taxTotal: numeric("tax_total", { precision: 15, scale: 4 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const poLines = pgTable("po_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  poId: uuid("po_id").notNull(),
  itemId: uuid("item_id").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  receivedQty: numeric("received_qty", { precision: 15, scale: 4 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 4 }).notNull().default("0"),
  taxRateId: uuid("tax_rate_id"),
  lineTotal: numeric("line_total", { precision: 15, scale: 4 }).notNull().default("0"),
});

export const grns = pgTable("grns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  grnNo: text("grn_no").notNull(),
  poId: uuid("po_id"),
  warehouseId: uuid("warehouse_id").notNull(),
  receiptDate: text("receipt_date").notNull(),
  status: grnStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const grnLines = pgTable("grn_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  grnId: uuid("grn_id").notNull(),
  poLineId: uuid("po_line_id"),
  itemId: uuid("item_id").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }).notNull().default("0"),
});

export type Requisition = typeof requisitions.$inferSelect;
export type RequisitionLine = typeof requisitionLines.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PoLine = typeof poLines.$inferSelect;
export type Grn = typeof grns.$inferSelect;
export type GrnLine = typeof grnLines.$inferSelect;
