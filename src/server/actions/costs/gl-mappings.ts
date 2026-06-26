"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { tenants } from "@/lib/db/schema";

export type GlMappings = {
  fleet_fuel_expense?: string;
  fleet_payable?: string;
  wo_maintenance_expense?: string;
  wo_payable?: string;
};

export async function saveGlMappingsAction(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("admin:settings:update", user);
  if (permError) return { success: false, error: permError.error };

  const mappings: GlMappings = {
    fleet_fuel_expense: (formData.get("fleet_fuel_expense") as string) || undefined,
    fleet_payable: (formData.get("fleet_payable") as string) || undefined,
    wo_maintenance_expense: (formData.get("wo_maintenance_expense") as string) || undefined,
    wo_payable: (formData.get("wo_payable") as string) || undefined,
  };

  // Remove empty strings
  for (const key of Object.keys(mappings) as (keyof GlMappings)[]) {
    if (!mappings[key]) delete mappings[key];
  }

  try {
    const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
    await withTenantRLS(ctx, async (tx) => {
      await tx
        .update(tenants)
        .set({
          settings: sql`jsonb_set(COALESCE(settings, '{}'), '{gl_mappings}', ${JSON.stringify(mappings)}::jsonb, true)`,
        })
        .where(eq(tenants.id, user.tenant_id));
      return { ok: true };
    });
  } catch {
    return { success: false, error: "Failed to save GL mappings." };
  }

  try {
    await createAuditLog({ entity: "gl_mappings", entityId: user.tenant_id, action: "update", userId: user.sub, tenantId: user.tenant_id, changes: mappings });
  } catch {}

  revalidatePath("/app/settings/gl-mappings");
  return { success: true };
}
