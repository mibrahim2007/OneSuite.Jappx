"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { db } from "@/lib/db";
import { gpsDevices, vehiclePositions, geofences, geofenceAlerts } from "@/lib/db/schema";
import { gpsDeviceSchema, geofenceSchema } from "@/lib/validations/gps";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

// ── GPS Devices ──────────────────────────────────────────────────────────────

export async function saveGpsDeviceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:geofence:manage", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim() || null;
  if (id && !UUID_RE.test(id)) return { success: false, error: "Invalid device ID." };

  const parsed = gpsDeviceSchema.safeParse({
    deviceId: (formData.get("deviceId") as string)?.trim(),
    vehicleId: (formData.get("vehicleId") as string)?.trim() || null,
    provider: (formData.get("provider") as string)?.trim() || null,
    apiKey: (formData.get("apiKey") as string)?.trim() || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      if (id) {
        await tx
          .update(gpsDevices)
          .set({ ...parsed.data })
          .where(and(eq(gpsDevices.id, id), eq(gpsDevices.tenantId, user.tenant_id)));
      } else {
        await tx.insert(gpsDevices).values({ tenantId: user.tenant_id, ...parsed.data });
      }
    });
  } catch {
    return { success: false, error: "Failed to save GPS device." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id, userId: user.sub,
      entity: "gps_devices", entityId: id ?? "new",
      action: id ? "gps_device_updated" : "gps_device_created",
      changes: parsed.data,
    });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/tracking");
  return { success: true };
}

export async function toggleGpsDeviceAction(
  deviceId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(deviceId)) return { success: false, error: "Invalid ID." };

  const permError = requirePermission("fleet:geofence:manage", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(gpsDevices).set({ isActive })
        .where(and(eq(gpsDevices.id, deviceId), eq(gpsDevices.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update device." };
  }

  revalidatePath("/app/fleet/tracking");
  return { success: true };
}

// ── Simulate Position (demo) ─────────────────────────────────────────────────

export async function simulatePositionAction(
  vehicleId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(vehicleId)) return { success: false, error: "Invalid vehicle ID." };

  const permError = requirePermission("fleet:tracking:view", user);
  if (permError) return { success: false, error: permError.error };

  // Karachi bounding box for demo positions
  const lat = (24.8 + Math.random() * 0.4).toFixed(7);
  const lng = (67.0 + Math.random() * 0.5).toFixed(7);
  const speed = (Math.random() * 80).toFixed(2);
  const heading = (Math.random() * 360).toFixed(2);

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(vehiclePositions).values({
        tenantId: user.tenant_id,
        vehicleId,
        lat,
        lng,
        speedKmh: speed,
        heading,
        eventType: "moving",
      });
    });
  } catch {
    return { success: false, error: "Failed to simulate position." };
  }

  revalidatePath("/app/fleet/tracking");
  return { success: true };
}

// ── Geofences ────────────────────────────────────────────────────────────────

export async function saveGeofenceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:geofence:manage", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim() || null;
  if (id && !UUID_RE.test(id)) return { success: false, error: "Invalid geofence ID." };

  const parsed = geofenceSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    type: (formData.get("type") as string)?.trim() || "circle",
    centerLat: (formData.get("centerLat") as string)?.trim() || null,
    centerLng: (formData.get("centerLng") as string)?.trim() || null,
    radiusM: (formData.get("radiusM") as string)?.trim() || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { name, type, centerLat, centerLng, radiusM } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      const vals = {
        name,
        type,
        centerLat: centerLat ?? null,
        centerLng: centerLng ?? null,
        radiusM: radiusM ?? null,
      };
      if (id) {
        await tx.update(geofences).set(vals)
          .where(and(eq(geofences.id, id), eq(geofences.tenantId, user.tenant_id)));
      } else {
        await tx.insert(geofences).values({ tenantId: user.tenant_id, ...vals });
      }
    });
  } catch {
    return { success: false, error: "Failed to save geofence." };
  }

  revalidatePath("/app/fleet/geofences");
  return { success: true };
}

export async function toggleGeofenceAction(
  geofenceId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(geofenceId)) return { success: false, error: "Invalid ID." };

  const permError = requirePermission("fleet:geofence:manage", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(geofences).set({ isActive })
        .where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update geofence." };
  }

  revalidatePath("/app/fleet/geofences");
  return { success: true };
}

export async function getGeofenceAlertsAction(tenantId: string) {
  return db
    .select({
      id: geofenceAlerts.id,
      geofenceId: geofenceAlerts.geofenceId,
      vehicleId: geofenceAlerts.vehicleId,
      eventType: geofenceAlerts.eventType,
      triggeredAt: geofenceAlerts.triggeredAt,
      lat: geofenceAlerts.lat,
      lng: geofenceAlerts.lng,
    })
    .from(geofenceAlerts)
    .where(eq(geofenceAlerts.tenantId, tenantId))
    .orderBy(geofenceAlerts.triggeredAt)
    .limit(100);
}
