import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  smallint,
  boolean,
  char,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

// --- Enums (already exist in DB) ---
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "call",
  "meeting",
  "email",
  "task",
  "note",
]);

export const quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
]);

// --- CRM Companies ---
export const crmCompanies = pgTable("crm_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  industry: text("industry"),
  website: text("website"),
  partyId: uuid("party_id"),   // nullable FK → contacts.id (AP/AR contact)
  ownerId: uuid("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- CRM Contacts ---
export const crmContacts = pgTable("crm_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  companyId: uuid("company_id"),  // nullable FK → crm_companies.id
  fullName: text("full_name").notNull(),
  email: text("email"),           // citext in DB; text in Drizzle
  phone: text("phone"),
  designation: text("designation"),
  ownerId: uuid("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Leads ---
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),           // citext in DB; text in Drizzle
  phone: text("phone"),
  source: text("source"),
  score: smallint("score").default(0),
  status: leadStatusEnum("status").notNull().default("new"),
  ownerId: uuid("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Pipeline Stages ---
export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  winProbability: smallint("win_probability").default(0),
});

// --- Opportunities ---
export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  companyId: uuid("company_id"),
  contactId: uuid("contact_id"),
  stageId: uuid("stage_id"),
  amount: numeric("amount", { precision: 15, scale: 4 }).default("0"),
  currency: char("currency", { length: 3 }).default("PKR"),
  expectedClose: text("expected_close"),  // date col → string "YYYY-MM-DD"
  ownerId: uuid("owner_id"),
  isWon: boolean("is_won"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Activities ---
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  subject: text("subject").notNull(),
  notes: text("notes"),
  relatedEntity: text("related_entity"),  // 'lead', 'opportunity', 'crm_contact'
  relatedId: uuid("related_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ownerId: uuid("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Quotations ---
export const quotations = pgTable("quotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  quoteNo: text("quote_no").notNull(),
  opportunityId: uuid("opportunity_id"),
  companyId: uuid("company_id"),
  quoteDate: text("quote_date").notNull(),   // date → text
  validUntil: text("valid_until"),           // date → text
  subtotal: numeric("subtotal", { precision: 15, scale: 4 }).default("0"),
  taxTotal: numeric("tax_total", { precision: 15, scale: 4 }).default("0"),
  total: numeric("total", { precision: 15, scale: 4 }).default("0"),
  status: quotationStatusEnum("status").notNull().default("draft"),
  invoiceId: uuid("invoice_id"),  // set after converting to invoice
});

// --- Quotation Lines ---
export const quotationLines = pgTable("quotation_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  quotationId: uuid("quotation_id").notNull(),
  itemId: uuid("item_id"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 4 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 15, scale: 4 }).notNull().default("0"),
});

// Type exports
export type CrmCompany = typeof crmCompanies.$inferSelect;
export type CrmContact = typeof crmContacts.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type QuotationLine = typeof quotationLines.$inferSelect;
