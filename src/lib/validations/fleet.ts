import { z } from "zod";

export const VEHICLE_STATUSES = ["active", "in_service", "idle", "retired"] as const;
export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  in_service: "In Service",
  idle: "Idle",
  retired: "Retired",
};

export const TRIP_STATUSES = ["planned", "dispatched", "in_progress", "completed", "cancelled"] as const;
export const TRIP_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const vehicleSchema = z.object({
  regNumber: z.string().min(1, "Registration number is required.").max(50),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z
    .string()
    .regex(/^\d{4}$/, "Invalid year.")
    .optional()
    .nullable(),
  type: z.string().max(50).optional().nullable(),
  capacity: z.string().max(50).optional().nullable(),
  odometer: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid odometer value.")
    .optional()
    .nullable(),
  status: z.enum(VEHICLE_STATUSES).default("active"),
});

export const driverSchema = z.object({
  name: z.string().min(1, "Name is required.").max(200),
  licenseNo: z.string().max(100).optional().nullable(),
  licenseExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
    .optional()
    .nullable(),
  phone: z.string().max(50).optional().nullable(),
});

export const tripSchema = z.object({
  vehicleId: z.string().uuid("Select a vehicle."),
  driverId: z.string().uuid("Invalid driver.").optional().nullable(),
  origin: z.string().max(200).optional().nullable(),
  destination: z.string().max(200).optional().nullable(),
  startOdometer: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid odometer.")
    .optional()
    .nullable(),
  endOdometer: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid odometer.")
    .optional()
    .nullable(),
});

export const fuelLogSchema = z.object({
  vehicleId: z.string().uuid("Select a vehicle."),
  tripId: z.string().uuid("Invalid trip.").optional().nullable(),
  fuelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  litres: z.string().regex(/^\d+(\.\d{1,3})?$/, "Invalid litres.").refine((v) => parseFloat(v) > 0, "Must be > 0."),
  cost: z.string().regex(/^\d+(\.\d{1,4})?$/, "Invalid cost.").refine((v) => parseFloat(v) >= 0, "Must be ≥ 0."),
  odometer: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid odometer.").optional().nullable(),
  station: z.string().max(200).optional().nullable(),
});

export const vehicleDocumentSchema = z.object({
  vehicleId: z.string().uuid("Select a vehicle."),
  docType: z.string().min(1, "Document type is required.").max(100),
  docNumber: z.string().max(100).optional().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.").optional().nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.").optional().nullable(),
  alertDays: z.string().regex(/^\d+$/, "Invalid days.").optional().nullable(),
});
