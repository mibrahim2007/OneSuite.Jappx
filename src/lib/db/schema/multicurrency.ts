import {
  pgTable,
  uuid,
  char,
  text,
  boolean,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

import { tenants } from "./platform";
import { accounts } from "./accounts";
import { journalLines } from "./journals";

export const currencies = pgTable("currencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  code: char("code", { length: 3 }).notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull().default(""),
  isBase: boolean("is_base").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  fromCurrency: char("from_currency", { length: 3 }).notNull(),
  toCurrency: char("to_currency", { length: 3 }).notNull(),
  rate: numeric("rate", { precision: 18, scale: 6 }).notNull(),
  effectiveDate: text("effective_date").notNull(), // date stored as text "YYYY-MM-DD"
  source: text("source").notNull().default("manual"),
});

export const bankStatements = pgTable("bank_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  statementDate: text("statement_date").notNull(),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  closingBalance: numeric("closing_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  isReconciled: boolean("is_reconciled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bankStatementLines = pgTable("bank_statement_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  statementId: uuid("statement_id")
    .notNull()
    .references(() => bankStatements.id, { onDelete: "cascade" }),
  lineDate: text("line_date").notNull(),
  description: text("description"),
  debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0"),
  reference: text("reference"),
  matchedJournalLineId: uuid("matched_journal_line_id").references(
    () => journalLines.id,
    { onDelete: "set null" }
  ),
});

export type Currency = typeof currencies.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type BankStatement = typeof bankStatements.$inferSelect;
export type BankStatementLine = typeof bankStatementLines.$inferSelect;
