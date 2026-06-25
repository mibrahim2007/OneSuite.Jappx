import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";

import { tenants } from "./platform";
import { accounts } from "./accounts";
import { contacts } from "./contacts";
import { fiscalPeriods } from "./fiscal-periods";
import { taxRates } from "./settings";
import { journals } from "./journals";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => contacts.id),
  invoiceNo: text("invoice_no").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  periodId: uuid("period_id").references(() => fiscalPeriods.id),
  reference: text("reference"),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 18, scale: 2 }).notNull().default("0"),
  receivableAccountId: uuid("receivable_account_id").notNull().references(() => accounts.id),
  journalId: uuid("journal_id").references(() => journals.id),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  sortOrder: smallint("sort_order").notNull().default(0),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  description: text("description"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  taxRateId: uuid("tax_rate_id").references(() => taxRates.id),
  taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
