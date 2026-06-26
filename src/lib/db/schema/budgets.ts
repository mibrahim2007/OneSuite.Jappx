import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";
import { accounts } from "./accounts";

export const budgetStatusEnum = pgEnum("budget_status", [
  "draft",
  "active",
  "closed",
]);

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  status: budgetStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetLines = pgTable("budget_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id").notNull(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id"),
  periodMonth: text("period_month").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
});

export type Budget = typeof budgets.$inferSelect;
export type BudgetLine = typeof budgetLines.$inferSelect;
