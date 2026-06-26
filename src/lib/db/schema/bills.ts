import {
  pgTable,
  uuid,
  text,
  numeric,
  char,
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

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => contacts.id),
  billNo: text("bill_no").notNull(),
  billDate: date("bill_date").notNull(),
  dueDate: date("due_date").notNull(),
  periodId: uuid("period_id").references(() => fiscalPeriods.id),
  reference: text("reference"),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 18, scale: 2 }).notNull().default("0"),
  payableAccountId: uuid("payable_account_id").notNull().references(() => accounts.id),
  currencyCode: char("currency_code", { length: 3 }).notNull().default("PKR"),
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 6 }).notNull().default("1"),
  journalId: uuid("journal_id").references(() => journals.id),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billLines = pgTable("bill_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  billId: uuid("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  sortOrder: smallint("sort_order").notNull().default(0),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  description: text("description"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  taxRateId: uuid("tax_rate_id").references(() => taxRates.id),
  taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
});

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillLine = typeof billLines.$inferSelect;
export type NewBillLine = typeof billLines.$inferInsert;
