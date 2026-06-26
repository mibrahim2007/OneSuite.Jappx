import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

import { tenants } from "./platform";

export const pmBasisEnum = pgEnum("pm_basis", ["time", "meter"]);
export const woPriorityEnum = pgEnum("wo_priority", ["low", "medium", "high", "critical"]);
export const woStatusEnum = pgEnum("wo_status", [
  "open", "assigned", "in_progress", "on_hold", "completed", "closed", "cancelled",
]);
export const woTypeEnum = pgEnum("wo_type", ["corrective", "preventive", "inspection"]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  parentId: uuid("parent_id"),
  location: text("location"),
  warehouseId: uuid("warehouse_id"),
  purchaseDate: text("purchase_date"),
  purchaseCost: numeric("purchase_cost", { precision: 15, scale: 4 }),
  warrantyExpiry: text("warranty_expiry"),
  meterReading: numeric("meter_reading", { precision: 15, scale: 2 }).default("0"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  woNo: text("wo_no").notNull(),
  assetId: uuid("asset_id"),
  type: woTypeEnum("type").notNull().default("corrective"),
  priority: woPriorityEnum("priority").notNull().default("medium"),
  status: woStatusEnum("status").notNull().default("open"),
  title: text("title").notNull(),
  description: text("description"),
  reportedBy: uuid("reported_by"),
  assignedTo: uuid("assigned_to"),
  scheduledDate: text("scheduled_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  laborHours: numeric("labor_hours", { precision: 10, scale: 2 }).default("0"),
  laborCost: numeric("labor_cost", { precision: 15, scale: 4 }).default("0"),
  partsCost: numeric("parts_cost", { precision: 15, scale: 4 }).default("0"),
  totalCost: numeric("total_cost", { precision: 15, scale: 4 }).default("0"),
  journalId: uuid("journal_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const woTasks = pgTable("wo_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workOrderId: uuid("work_order_id").notNull(),
  description: text("description").notNull(),
  isDone: boolean("is_done").notNull().default(false),
});

export const woParts = pgTable("wo_parts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workOrderId: uuid("work_order_id").notNull(),
  itemId: uuid("item_id").notNull(),
  warehouseId: uuid("warehouse_id"),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 4 }).notNull().default("0"),
});

export const pmSchedules = pgTable("pm_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").notNull(),
  name: text("name").notNull(),
  basis: pmBasisEnum("basis").notNull().default("time"),
  intervalDays: integer("interval_days"),
  intervalMeter: numeric("interval_meter", { precision: 15, scale: 2 }),
  lastDoneDate: text("last_done_date"),
  lastDoneMeter: numeric("last_done_meter", { precision: 15, scale: 2 }),
  nextDueDate: text("next_due_date"),
  isActive: boolean("is_active").notNull().default(true),
});

export type Asset = typeof assets.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type WoTask = typeof woTasks.$inferSelect;
export type WoPart = typeof woParts.$inferSelect;
export type PmSchedule = typeof pmSchedules.$inferSelect;
