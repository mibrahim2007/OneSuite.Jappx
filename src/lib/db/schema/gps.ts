import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./platform";
import { vehicles } from "./fleet";

export const gpsDevices = pgTable("gps_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  provider: text("provider"),
  apiKey: text("api_key"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehiclePositions = pgTable("vehicle_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  speedKmh: numeric("speed_kmh", { precision: 8, scale: 2 }),
  heading: numeric("heading", { precision: 6, scale: 2 }),
  odometerKm: numeric("odometer_km", { precision: 12, scale: 2 }),
  eventType: text("event_type").notNull().default("moving"),
});

export const gpsTripSegments = pgTable("gps_trip_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id"),
  tripId: uuid("trip_id"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  startLat: numeric("start_lat", { precision: 10, scale: 7 }),
  startLng: numeric("start_lng", { precision: 10, scale: 7 }),
  endLat: numeric("end_lat", { precision: 10, scale: 7 }),
  endLng: numeric("end_lng", { precision: 10, scale: 7 }),
  distanceKm: numeric("distance_km", { precision: 12, scale: 2 }),
  maxSpeed: numeric("max_speed", { precision: 8, scale: 2 }),
  avgSpeed: numeric("avg_speed", { precision: 8, scale: 2 }),
  idleMinutes: numeric("idle_minutes", { precision: 8, scale: 2 }),
});

export const geofences = pgTable("geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("circle"),
  centerLat: numeric("center_lat", { precision: 10, scale: 7 }),
  centerLng: numeric("center_lng", { precision: 10, scale: 7 }),
  radiusM: numeric("radius_m", { precision: 10, scale: 2 }),
  polygonCoords: jsonb("polygon_coords"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const geofenceAlerts = pgTable("geofence_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  geofenceId: uuid("geofence_id")
    .notNull()
    .references(() => geofences.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
});

export type GpsDevice = typeof gpsDevices.$inferSelect;
export type VehiclePosition = typeof vehiclePositions.$inferSelect;
export type GpsTripSegment = typeof gpsTripSegments.$inferSelect;
export type Geofence = typeof geofences.$inferSelect;
export type GeofenceAlert = typeof geofenceAlerts.$inferSelect;
