import {
  pgTable,
  uuid,
  text,
  boolean,
  char,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { tenants } from "./platform";

export const accountGroups = pgTable("account_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  parentId: uuid("parent_id"),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    groupId: uuid("group_id").references(() => accountGroups.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    isBank: boolean("is_bank").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    currency: char("currency", { length: 3 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("accounts_tenant_code_key").on(t.tenantId, t.code)]
);

export type AccountGroup = typeof accountGroups.$inferSelect;
export type NewAccountGroup = typeof accountGroups.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
