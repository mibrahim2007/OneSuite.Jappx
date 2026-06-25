import {
  pgTable,
  uuid,
  text,
  smallint,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

export const fiscalPeriods = pgTable(
  "fiscal_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    yearLabel: text("year_label").notNull(),
    periodNum: smallint("period_num").notNull(),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("fiscal_periods_tenant_year_period_key").on(
      t.tenantId,
      t.yearLabel,
      t.periodNum
    ),
  ]
);

export type FiscalPeriod = typeof fiscalPeriods.$inferSelect;
export type NewFiscalPeriod = typeof fiscalPeriods.$inferInsert;
