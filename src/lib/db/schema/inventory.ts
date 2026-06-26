import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

// --- Enums (already exist in DB) ---
export const valuationMethodEnum = pgEnum("valuation_method", [
  "fifo",
  "weighted_average",
  "standard",
]);

export const stockMoveTypeEnum = pgEnum("stock_move_type", [
  "receipt",
  "issue",
  "transfer",
  "adjustment",
  "return",
]);

// --- Item Categories ---
export const itemCategories = pgTable("item_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id"), // self-ref FK exists in DB; omitted here to avoid circular reference
});

export type ItemCategory = typeof itemCategories.$inferSelect;

// --- Units of Measure ---
export const uoms = pgTable("uoms", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
});

export type Uom = typeof uoms.$inferSelect;

// --- Items (stub for FK references in actions; fully defined in Story 7.2) ---
export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  categoryId: uuid("category_id"),
  uomId: uuid("uom_id"),
  barcode: text("barcode"),
  isStock: boolean("is_stock").notNull().default(true),
  valuation: valuationMethodEnum("valuation").notNull().default("weighted_average"),
  purchasePrice: numeric("purchase_price", { precision: 15, scale: 4 }),
  salePrice: numeric("sale_price", { precision: 15, scale: 4 }),
  reorderLevel: numeric("reorder_level", { precision: 15, scale: 4 }),
  inventoryAccountId: uuid("inventory_account_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Item = typeof items.$inferSelect;
export type ItemInsert = typeof items.$inferInsert;

// --- Warehouses ---
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
});

export type Warehouse = typeof warehouses.$inferSelect;

// --- Stock Levels ---
export const stockLevels = pgTable("stock_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull().default("0"),
  avgCost: numeric("avg_cost", { precision: 15, scale: 4 }).notNull().default("0"),
});

export type StockLevel = typeof stockLevels.$inferSelect;

// --- Stock Moves ---
export const stockMoves = pgTable("stock_moves", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  moveType: stockMoveTypeEnum("move_type").notNull(),
  itemId: uuid("item_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  toWarehouseId: uuid("to_warehouse_id"),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }),
  reference: text("reference"),
  moveDate: text("move_date").notNull(), // date column → string "YYYY-MM-DD"
  createdBy: uuid("created_by").notNull(),
});

export type StockMove = typeof stockMoves.$inferSelect;
