import { z } from "zod";

export const gpsDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required.").max(100),
  vehicleId: z.string().uuid("Select a vehicle.").optional().nullable(),
  provider: z.string().max(100).optional().nullable(),
  apiKey: z.string().max(200).optional().nullable(),
});

export const geofenceSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  type: z.enum(["circle", "polygon"]).default("circle"),
  centerLat: z.string().regex(/^-?\d+(\.\d+)?$/, "Invalid latitude.").optional().nullable(),
  centerLng: z.string().regex(/^-?\d+(\.\d+)?$/, "Invalid longitude.").optional().nullable(),
  radiusM: z.string().regex(/^\d+(\.\d+)?$/, "Invalid radius.").optional().nullable(),
});

export const gpsPingSchema = z.object({
  device_id: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  odometer: z.number().optional(),
  event_type: z.string().optional().default("moving"),
  timestamp: z.string().optional(),
});

export type GpsDeviceFormValues = z.infer<typeof gpsDeviceSchema>;
export type GeofenceFormValues = z.infer<typeof geofenceSchema>;
