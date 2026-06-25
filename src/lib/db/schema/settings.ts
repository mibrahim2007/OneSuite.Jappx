import { pgTable, uuid, text, numeric, boolean, smallint, integer } from "drizzle-orm/pg-core";

import { tenants } from "./platform";
import { accounts } from "./accounts";

export const taxRates = pgTable("tax_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 9, scale: 4 }).notNull(),
  type: text("type").notNull().default("gst"),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
});

export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;

export const numberSeries = pgTable("number_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  prefix: text("prefix").notNull().default(""),
  padding: smallint("padding").notNull().default(5),
  nextNumber: integer("next_number").notNull().default(1),
  resetCycle: text("reset_cycle").notNull().default("never"),
});

export type NumberSeries = typeof numberSeries.$inferSelect;
export type NewNumberSeries = typeof numberSeries.$inferInsert;
