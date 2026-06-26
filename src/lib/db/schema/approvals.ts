import {
  pgTable,
  pgEnum,
  uuid,
  text,
  smallint,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  currentStep: smallint("current_step").notNull().default(1),
  requestedBy: uuid("requested_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalSteps = pgTable("approval_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => approvalRequests.id, { onDelete: "cascade" }),
  stepNo: smallint("step_no").notNull(),
  approverId: uuid("approver_id"),
  status: approvalStatusEnum("status").notNull().default("pending"),
  comment: text("comment"),
  actedAt: timestamp("acted_at", { withTimezone: true }),
});

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type ApprovalStep = typeof approvalSteps.$inferSelect;
