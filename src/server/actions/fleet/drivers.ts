"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { drivers } from "@/lib/db/schema";
import { driverSchema } from "@/lib/validations/fleet";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DriverState = { success: true } | { success: false; error: string } | null;

function parseDriverForm(formData: FormData) {
  return driverSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    licenseNo: (formData.get("licenseNo") as string) || null,
    licenseExpiry: (formData.get("licenseExpiry") as string) || null,
    phone: (formData.get("phone") as string) || null,
  });
}

export async function createDriverAction(
  _prevState: DriverState,
  formData: FormData
): Promise<DriverState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:driver:create", user);
  if (permError) return permError;

  const parsed = parseDriverForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { name, licenseNo, licenseExpiry, phone } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let insertedId: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx.insert(drivers).values({
        tenantId: user.tenant_id,
        name,
        licenseNo: licenseNo || null,
        licenseExpiry: licenseExpiry || null,
        phone: phone || null,
        isActive: true,
      }).returning({ id: drivers.id });
      insertedId = inserted!.id;
    });
  } catch {
    return { success: false, error: "Failed to create driver." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "drivers", entityId: insertedId, action: "driver_created", changes: { name } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/drivers");
  return { success: true };
}

export async function updateDriverAction(
  _prevState: DriverState,
  formData: FormData
): Promise<DriverState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:driver:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid driver ID." };

  const parsed = parseDriverForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { name, licenseNo, licenseExpiry, phone } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: drivers.id }).from(drivers)
        .where(and(eq(drivers.id, id), eq(drivers.tenantId, user.tenant_id))).limit(1);
      if (!existing) return { notFound: true };

      await tx.update(drivers).set({
        name,
        licenseNo: licenseNo || null,
        licenseExpiry: licenseExpiry || null,
        phone: phone || null,
      }).where(and(eq(drivers.id, id), eq(drivers.tenantId, user.tenant_id)));

      return { notFound: false };
    });
  } catch {
    return { success: false, error: "Failed to update driver." };
  }

  if (result.notFound) return { success: false, error: "Driver not found." };

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "drivers", entityId: id, action: "driver_updated", changes: { name } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/drivers");
  return { success: true };
}

export async function toggleDriverActiveAction(
  driverId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(driverId)) return { success: false, error: "Invalid driver ID." };

  const permError = requirePermission("fleet:driver:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(drivers).set({ isActive })
        .where(and(eq(drivers.id, driverId), eq(drivers.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update driver." };
  }

  revalidatePath("/app/fleet/drivers");
  return { success: true };
}
