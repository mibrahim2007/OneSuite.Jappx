"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { numberSeries } from "@/lib/db/schema";
import { numberSeriesSchema } from "@/lib/validations/settings";
import { createAuditLog } from "@/lib/audit";

type NumberSeriesActionState =
  | { success: true }
  | { success: false; error: string }
  | null;


export async function upsertNumberSeriesAction(
  _prevState: NumberSeriesActionState,
  formData: FormData
): Promise<NumberSeriesActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("admin:settings:update", user);
  if (permError) return { success: false, error: "Permission denied." };

  const parsed = numberSeriesSchema.safeParse({
    docType: formData.get("docType"),
    prefix: (formData.get("prefix") as string) ?? "",
    padding: parseInt(formData.get("padding") as string, 10),
    nextNumber: parseInt(formData.get("nextNumber") as string, 10),
    resetCycle: formData.get("resetCycle"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { docType, prefix, padding, nextNumber, resetCycle } = parsed.data;

  const ctx = {
    tenantId: user.tenant_id,
    userId: user.sub,
    permissions: user.permissions,
  };

  await withTenantRLS(ctx, async (tx) => {
    await tx
      .insert(numberSeries)
      .values({
        tenantId: user.tenant_id,
        docType,
        prefix,
        padding,
        nextNumber,
        resetCycle,
      })
      .onConflictDoUpdate({
        target: [numberSeries.tenantId, numberSeries.docType],
        set: { prefix, padding, nextNumber, resetCycle },
      });
  });

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "number_series",
    entityId: null,
    action: "number_series_upserted",
    changes: { docType, prefix, padding, nextNumber, resetCycle },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
