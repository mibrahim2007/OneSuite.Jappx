"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { requisitions, requisitionLines } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";
import { requisitionSchema } from "@/lib/validations/procurement";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/procurement/requisitions";

type ActionState = { success: true } | { success: false; error: string } | null;

export async function createRequisitionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("scm:requisition:create", user);
  if (permError) return { success: false, error: permError.error };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse((formData.get("lines") as string) || "[]");
  } catch {
    return { success: false, error: "Invalid lines data." };
  }

  const parsed = requisitionSchema.safeParse({
    reqNo: (formData.get("reqNo") as string)?.trim(),
    reqDate: formData.get("reqDate"),
    notes: (formData.get("notes") as string)?.trim() || null,
    lines: rawLines,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { reqNo, reqDate, notes, lines } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let reqId: string;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      try {
        const [inserted] = await tx
          .insert(requisitions)
          .values({
            tenantId: user.tenant_id,
            reqNo,
            requestedBy: user.sub,
            reqDate,
            notes: notes ?? null,
          })
          .returning({ id: requisitions.id });

        await tx.insert(requisitionLines).values(
          lines.map((l) => ({
            tenantId: user.tenant_id,
            requisitionId: inserted!.id,
            itemId: l.itemId,
            quantity: l.quantity,
          }))
        );

        return { duplicate: false, id: inserted!.id };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "23505"
        ) {
          return { duplicate: true, id: "" };
        }
        throw err;
      }
    });
    if (result.duplicate) return { success: false, error: "Req No already in use." };
    reqId = result.id;
  } catch {
    return { success: false, error: "Failed to create requisition." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "requisitions",
      entityId: reqId,
      action: "requisition_created",
      changes: { reqNo, reqDate },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateRequisitionStatusAction(
  id: string,
  newStatus: "submitted" | "approved" | "rejected"
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(id)) return { success: false, error: "Invalid requisition ID." };

  const perm =
    newStatus === "submitted" ? "scm:requisition:create" : "scm:requisition:approve";
  const permError = requirePermission(perm, user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let error: string | null = null;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [req] = await tx
        .select({ status: requisitions.status })
        .from(requisitions)
        .where(and(eq(requisitions.id, id), eq(requisitions.tenantId, user.tenant_id)))
        .limit(1);

      if (!req) { error = "Requisition not found."; return; }

      const validFrom: Record<string, string[]> = {
        submitted: ["draft"],
        approved: ["submitted"],
        rejected: ["submitted"],
      };
      if (!validFrom[newStatus]?.includes(req.status)) {
        error = `Cannot move from ${req.status} to ${newStatus}.`;
        return;
      }

      await tx
        .update(requisitions)
        .set({ status: newStatus })
        .where(and(eq(requisitions.id, id), eq(requisitions.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update status." };
  }

  if (error) return { success: false, error };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "requisitions",
      entityId: id,
      action: `requisition_${newStatus}`,
      changes: { status: newStatus },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE);
  return { success: true };
}
