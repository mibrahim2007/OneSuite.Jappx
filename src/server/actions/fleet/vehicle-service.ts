"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { vehicles, vehicleServiceSchedules, workOrders } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

function genWoNo(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `WO-${d}-${r}`;
}

export async function generateServiceWoAction(
  vehicleId: string,
  scheduleId?: string
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:workorder:create", user);
  if (permError) return { success: false, error: permError.error };

  if (!UUID_RE.test(vehicleId)) return { success: false, error: "Invalid vehicle ID." };
  if (scheduleId && !UUID_RE.test(scheduleId)) return { success: false, error: "Invalid schedule ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let woId: string;
  try {
    woId = await withTenantRLS(ctx, async (tx) => {
      // Fetch vehicle + its linked asset
      const [vehicle] = await tx
        .select({ id: vehicles.id, regNumber: vehicles.regNumber, assetId: vehicles.assetId })
        .from(vehicles)
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.tenantId, user.tenant_id)))
        .limit(1);

      if (!vehicle) throw new Error("Vehicle not found.");

      // Fetch schedule name if provided
      let serviceType = "Service";
      if (scheduleId) {
        const [sched] = await tx
          .select({ serviceType: vehicleServiceSchedules.serviceType })
          .from(vehicleServiceSchedules)
          .where(and(eq(vehicleServiceSchedules.id, scheduleId), eq(vehicleServiceSchedules.tenantId, user.tenant_id)))
          .limit(1);
        if (sched) serviceType = sched.serviceType;
      }

      const [inserted] = await tx.insert(workOrders).values({
        tenantId: user.tenant_id,
        woNo: genWoNo(),
        assetId: vehicle.assetId ?? null,
        type: "preventive",
        priority: "medium",
        status: "open",
        title: `${serviceType} — ${vehicle.regNumber}`,
        description: `Auto-generated service WO for vehicle ${vehicle.regNumber}.`,
        reportedBy: user.sub,
      }).returning({ id: workOrders.id });

      return inserted!.id;
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate work order.";
    return { success: false, error: msg };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "work_orders",
      entityId: woId,
      action: "service_wo_generated",
      changes: { vehicleId, scheduleId },
    });
  } catch { /* non-fatal */ }

  revalidatePath(`/app/fleet/vehicles/${vehicleId}`);
  revalidatePath("/app/rm/work-orders");
  revalidatePath("/app/fleet/maintenance");
  return { success: true };
}

export async function completeServiceScheduleAction(
  scheduleId: string,
  serviceDate: string,
  serviceKm: string | null
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:vehicle:update", user);
  if (permError) return { success: false, error: permError.error };

  if (!UUID_RE.test(scheduleId)) return { success: false, error: "Invalid schedule ID." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return { success: false, error: "Invalid service date." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      const [sched] = await tx
        .select()
        .from(vehicleServiceSchedules)
        .where(and(eq(vehicleServiceSchedules.id, scheduleId), eq(vehicleServiceSchedules.tenantId, user.tenant_id)))
        .limit(1);

      if (!sched) throw new Error("Schedule not found.");

      // Compute next due date
      let nextDueDate: string | null = null;
      if (sched.intervalDays) {
        const d = new Date(serviceDate);
        d.setDate(d.getDate() + sched.intervalDays);
        nextDueDate = d.toISOString().slice(0, 10);
      }

      // Compute next due km
      let nextDueKm: string | null = null;
      const km = serviceKm ? parseFloat(serviceKm) : null;
      if (km !== null && sched.intervalKm) {
        nextDueKm = String(km + parseFloat(sched.intervalKm));
      }

      await tx.update(vehicleServiceSchedules)
        .set({
          lastServiceDate: serviceDate,
          lastServiceKm: serviceKm ?? null,
          nextDueDate: nextDueDate ?? sched.nextDueDate,
          nextDueKm: nextDueKm ?? sched.nextDueKm,
        })
        .where(eq(vehicleServiceSchedules.id, scheduleId));
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to complete schedule.";
    return { success: false, error: msg };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "vehicle_service_schedules",
      entityId: scheduleId,
      action: "service_completed",
      changes: { serviceDate, serviceKm },
    });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/maintenance");
  return { success: true };
}
