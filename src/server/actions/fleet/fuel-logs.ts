"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { fuelLogs } from "@/lib/db/schema";
import { fuelLogSchema } from "@/lib/validations/fleet";
import { createAuditLog } from "@/lib/audit";

type FuelLogState = { success: true } | { success: false; error: string } | null;

export async function createFuelLogAction(
  _prevState: FuelLogState,
  formData: FormData
): Promise<FuelLogState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:fuel:create", user);
  if (permError) return permError;

  const parsed = fuelLogSchema.safeParse({
    vehicleId: (formData.get("vehicleId") as string)?.trim(),
    tripId: (formData.get("tripId") as string) || null,
    fuelDate: (formData.get("fuelDate") as string)?.trim(),
    litres: (formData.get("litres") as string)?.trim(),
    cost: (formData.get("cost") as string)?.trim(),
    odometer: (formData.get("odometer") as string) || null,
    station: (formData.get("station") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { vehicleId, tripId, fuelDate, litres, cost, odometer, station } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let insertedId: string | null = null;

  try {
    await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx.insert(fuelLogs).values({
        tenantId: user.tenant_id,
        vehicleId,
        tripId: tripId || null,
        fuelDate,
        litres,
        cost,
        odometer: odometer || null,
        station: station || null,
      }).returning({ id: fuelLogs.id });
      insertedId = inserted!.id;
    });
  } catch {
    return { success: false, error: "Failed to create fuel log." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "fuel_logs", entityId: insertedId, action: "fuel_log_created", changes: { vehicleId, litres, cost } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/fuel-logs");
  return { success: true };
}
