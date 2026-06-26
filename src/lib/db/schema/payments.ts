import { pgTable, pgEnum, uuid, text, numeric, char, date, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./platform";
import { accounts } from "./accounts";
import { contacts } from "./contacts";
import { journals } from "./journals";

export const paymentDirectionEnum = pgEnum("payment_direction", ["inbound", "outbound"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "bank", "cheque", "card", "online", "adjustment",
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paymentNo: text("payment_no").notNull(),
  direction: paymentDirectionEnum("direction").notNull(),
  partyId: uuid("party_id").references(() => contacts.id),
  bankAccountId: uuid("bank_account_id").references(() => accounts.id),
  method: paymentMethodEnum("method").notNull().default("bank"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  reference: text("reference"),
  currencyCode: char("currency_code", { length: 3 }).notNull().default("PKR"),
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 6 }).notNull().default("1"),
  journalId: uuid("journal_id").references(() => journals.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id"),
  billId: uuid("bill_id"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
