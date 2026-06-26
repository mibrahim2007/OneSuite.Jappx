import {
  pgTable,
  pgEnum,
  uuid,
  text,
  smallint,
  numeric,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "active",
  "in_service",
  "idle",
  "retired",
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "planned",
  "dispatched",
  "in_progress",
  "completed",
  "cancelled",
]);

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  regNumber: text("reg_number").notNull(),
  make: text("make"),
  model: text("model"),
  year: smallint("year"),
  type: text("type"),
  capacity: text("capacity"),
  assetId: uuid("asset_id"),
  odometer: numeric("odometer", { precision: 12, scale: 2 }).default("0"),
  status: vehicleStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id"),
  name: text("name").notNull(),
  licenseNo: text("license_no"),
  licenseExpiry: text("license_expiry"), // date → "YYYY-MM-DD"
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
});

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  tripNo: text("trip_no").notNull(),
  vehicleId: uuid("vehicle_id").notNull(),
  driverId: uuid("driver_id"),
  origin: text("origin"),
  destination: text("destination"),
  startOdometer: numeric("start_odometer", { precision: 12, scale: 2 }),
  endOdometer: numeric("end_odometer", { precision: 12, scale: 2 }),
  distanceKm: numeric("distance_km", { precision: 12, scale: 2 }),
  status: tripStatusEnum("status").notNull().default("planned"),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  expenseTotal: numeric("expense_total", { precision: 15, scale: 4 }).default("0"),
  journalId: uuid("journal_id"),
});

export const fuelLogs = pgTable("fuel_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").notNull(),
  tripId: uuid("trip_id"),
  fuelDate: text("fuel_date").notNull(), // date → string
  litres: numeric("litres", { precision: 10, scale: 3 }).notNull(),
  cost: numeric("cost", { precision: 15, scale: 4 }).notNull(),
  odometer: numeric("odometer", { precision: 12, scale: 2 }),
  station: text("station"),
});

export const vehicleDocuments = pgTable("vehicle_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").notNull(),
  docType: text("doc_type").notNull(),
  docNumber: text("doc_number"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  alertDays: integer("alert_days").default(30),
});

export const vehicleServiceSchedules = pgTable("vehicle_service_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").notNull(),
  serviceType: text("service_type").notNull(),
  intervalKm: numeric("interval_km", { precision: 12, scale: 2 }),
  intervalDays: integer("interval_days"),
  lastServiceKm: numeric("last_service_km", { precision: 12, scale: 2 }),
  lastServiceDate: text("last_service_date"),
  nextDueKm: numeric("next_due_km", { precision: 12, scale: 2 }),
  nextDueDate: text("next_due_date"),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type FuelLog = typeof fuelLogs.$inferSelect;
export type VehicleDocument = typeof vehicleDocuments.$inferSelect;
export type VehicleServiceSchedule = typeof vehicleServiceSchedules.$inferSelect;
