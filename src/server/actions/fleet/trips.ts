"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { trips, vehicles } from "@/lib/db/schema";
import { tripSchema, TRIP_STATUSES } from "@/lib/validations/fleet";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TripState = { success: true } | { success: false; error: string } | null;

export async function createTripAction(
  _prevState: TripState,
  formData: FormData
): Promise<TripState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:trip:create", user);
  if (permError) return permError;

  const parsed = tripSchema.safeParse({
    vehicleId: (formData.get("vehicleId") as string)?.trim(),
    driverId: (formData.get("driverId") as string) || null,
    origin: (formData.get("origin") as string) || null,
    destination: (formData.get("destination") as string) || null,
    startOdometer: (formData.get("startOdometer") as string) || null,
    endOdometer: (formData.get("endOdometer") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { vehicleId, driverId, origin, destination, startOdometer, endOdometer } = parsed.data;

  const tripNo = `TRIP-${Date.now()}`;
  let distanceKm: string | null = null;
  if (startOdometer && endOdometer) {
    const dist = parseFloat(endOdometer) - parseFloat(startOdometer);
    if (dist > 0) distanceKm = String(dist);
  }

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let insertedId: string | null = null;

  try {
    await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx.insert(trips).values({
        tenantId: user.tenant_id,
        tripNo,
        vehicleId,
        driverId: driverId || null,
        origin: origin || null,
        destination: destination || null,
        startOdometer: startOdometer || null,
        endOdometer: endOdometer || null,
        distanceKm,
        status: "planned",
      }).returning({ id: trips.id });
      insertedId = inserted!.id;
    });
  } catch {
    return { success: false, error: "Failed to create trip." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "trips", entityId: insertedId, action: "trip_created", changes: { tripNo } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/trips");
  return { success: true };
}

export async function updateTripStatusAction(
  tripId: string,
  status: typeof TRIP_STATUSES[number]
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(tripId)) return { success: false, error: "Invalid trip ID." };

  const permError = requirePermission("fleet:trip:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      const [trip] = await tx.select().from(trips)
        .where(and(eq(trips.id, tripId), eq(trips.tenantId, user.tenant_id))).limit(1);
      if (!trip) return;

      const now = new Date();
      const updates: Partial<typeof trips.$inferInsert> = { status };
      if (status === "in_progress") updates.startAt = now;
      if (status === "completed") {
        updates.endAt = now;
        // Update vehicle odometer if endOdometer exists
        if (trip.endOdometer && trip.vehicleId) {
          await tx.update(vehicles)
            .set({ odometer: trip.endOdometer, updatedAt: now })
            .where(and(eq(vehicles.id, trip.vehicleId), eq(vehicles.tenantId, user.tenant_id)));
        }
      }

      await tx.update(trips).set(updates)
        .where(and(eq(trips.id, tripId), eq(trips.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update trip status." };
  }

  revalidatePath("/app/fleet/trips");
  return { success: true };
}
