"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { vehicleDocuments } from "@/lib/db/schema";
import { vehicleDocumentSchema } from "@/lib/validations/fleet";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DocState = { success: true } | { success: false; error: string } | null;

export async function createVehicleDocumentAction(
  _prevState: DocState,
  formData: FormData
): Promise<DocState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("fleet:compliance:manage", user);
  if (permError) return permError;

  const parsed = vehicleDocumentSchema.safeParse({
    vehicleId: (formData.get("vehicleId") as string)?.trim(),
    docType: (formData.get("docType") as string)?.trim(),
    docNumber: (formData.get("docNumber") as string) || null,
    issueDate: (formData.get("issueDate") as string) || null,
    expiryDate: (formData.get("expiryDate") as string) || null,
    alertDays: (formData.get("alertDays") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { vehicleId, docType, docNumber, issueDate, expiryDate, alertDays } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let insertedId: string | null = null;

  try {
    await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx.insert(vehicleDocuments).values({
        tenantId: user.tenant_id,
        vehicleId,
        docType,
        docNumber: docNumber || null,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        alertDays: alertDays ? parseInt(alertDays) : 30,
      }).returning({ id: vehicleDocuments.id });
      insertedId = inserted!.id;
    });
  } catch {
    return { success: false, error: "Failed to create document." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "vehicle_documents", entityId: insertedId, action: "vehicle_document_created", changes: { vehicleId, docType } });
  } catch { /* non-fatal */ }

  revalidatePath("/app/fleet/vehicles");
  revalidatePath("/app/fleet/alerts");
  return { success: true };
}

export async function deleteVehicleDocumentAction(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(docId)) return { success: false, error: "Invalid document ID." };

  const permError = requirePermission("fleet:compliance:manage", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.delete(vehicleDocuments)
        .where(and(eq(vehicleDocuments.id, docId), eq(vehicleDocuments.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to delete document." };
  }

  revalidatePath("/app/fleet/vehicles");
  revalidatePath("/app/fleet/alerts");
  return { success: true };
}
