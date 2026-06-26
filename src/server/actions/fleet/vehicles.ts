"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { vehicles } from "@/lib/db/schema";
import { vehicleSchema, VEHICLE_STATUSES } from "@/lib/validations/fleet";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VehicleState = { success: true } | { success: false; error: string } | null;

function parseVehicleForm(formData: FormData) {
  return vehicleSchema.safeParse({
    regNumber: (formData.get("regNumber") as string)?.trim(),
    make: (formData.get("make") as string) || null,
    model: (formData.get("model") as string) || null,
    year: (formData.get("year") as string) || null,
    type: (formData.get("type") as string) || null,
    capacity: (formData.get("capacity") as string) || null,
    odometer: (formData.get("odometer") as string) || null,
    status: (formData.get("status") as string) || "active",
  });
}

export async function createVehicleAction(
  _prevState: VehicleState,
  formData: FormData
): Promise<VehicleState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:vehicle:create", user);
  if (permError) return permError;

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { regNumber, make, model, year, type, capacity, odometer, status } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { duplicate: boolean; id: string | null };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(vehicles)
          .values({
            tenantId: user.tenant_id,
            regNumber,
            make: make || null,
            model: model || null,
            year: year ? parseInt(year) as unknown as number : null,
            type: type || null,
            capacity: capacity || null,
            odometer: odometer || "0",
            status,
          })
          .returning({ id: vehicles.id });
        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
          return { duplicate: true, id: null as string | null };
        }
        throw err;
      }
    });
  } catch {
    return { success: false, error: "Failed to create vehicle." };
  }

  if (result.duplicate) return { success: false, error: "Registration number already in use." };

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "vehicles", entityId: result.id, action: "vehicle_created", changes: { regNumber } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/vehicles");
  return { success: true };
}

export async function updateVehicleAction(
  _prevState: VehicleState,
  formData: FormData
): Promise<VehicleState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:vehicle:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid vehicle ID." };

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { regNumber, make, model, year, type, capacity, odometer, status } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: vehicles.id }).from(vehicles)
        .where(and(eq(vehicles.id, id), eq(vehicles.tenantId, user.tenant_id))).limit(1);
      if (!existing) return { notFound: true };

      await tx.update(vehicles).set({
        regNumber,
        make: make || null,
        model: model || null,
        year: year ? parseInt(year) as unknown as number : null,
        type: type || null,
        capacity: capacity || null,
        odometer: odometer || "0",
        status,
        updatedAt: new Date(),
      }).where(and(eq(vehicles.id, id), eq(vehicles.tenantId, user.tenant_id)));

      return { notFound: false };
    });
  } catch {
    return { success: false, error: "Failed to update vehicle." };
  }

  if (result.notFound) return { success: false, error: "Vehicle not found." };

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "vehicles", entityId: id, action: "vehicle_updated", changes: { regNumber } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/vehicles");
  return { success: true };
}

export async function updateVehicleStatusAction(
  vehicleId: string,
  status: typeof VEHICLE_STATUSES[number]
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(vehicleId)) return { success: false, error: "Invalid vehicle ID." };

  const permError = requirePermission("fleet:vehicle:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(vehicles).set({ status, updatedAt: new Date() })
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update vehicle status." };
  }

  revalidatePath("/app/fleet/vehicles");
  return { success: true };
}
