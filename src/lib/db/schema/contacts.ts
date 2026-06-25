import {
  pgTable,
  uuid,
  text,
  smallint,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

import { tenants } from "./platform";

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  paymentTermsDays: smallint("payment_terms_days").default(30),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
