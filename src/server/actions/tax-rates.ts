"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { taxRates } from "@/lib/db/schema";
import { taxRateSchema } from "@/lib/validations/settings";
import { createAuditLog } from "@/lib/audit";

type TaxRateActionState = { success: true } | { success: false; error: string } | null;


export async function saveTaxRateAction(
  _prevState: TaxRateActionState,
  formData: FormData
): Promise<TaxRateActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("admin:settings:update", user);
  if (permError) return { success: false, error: "Permission denied." };

  const parsed = taxRateSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    rate: parseFloat(formData.get("rate") as string),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id, name, rate, type } = parsed.data;

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  if (id) {
    // Update existing
    await withTenantRLS(ctx, async (tx) => {
      await tx
        .update(taxRates)
        .set({ name, rate: String(rate), type })
        .where(and(eq(taxRates.id, id), eq(taxRates.tenantId, user.tenant_id)));
    });
  } else {
    // Create new
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(taxRates).values({
        tenantId: user.tenant_id,
        name,
        rate: String(rate),
        type,
        isActive: true,
      });
    });
  }

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "tax_rates",
    entityId: id ?? null,
    action: id ? "tax_rate_updated" : "tax_rate_created",
    changes: { name, rate, type },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function setTaxRateActiveAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("admin:settings:update", user);
  if (permError) return { success: false, error: "Permission denied." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  await withTenantRLS(ctx, async (tx) => {
    await tx
      .update(taxRates)
      .set({ isActive })
      .where(and(eq(taxRates.id, id), eq(taxRates.tenantId, user.tenant_id)));
  });

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "tax_rates",
    entityId: id,
    action: "tax_rate_toggled",
    changes: { isActive },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
