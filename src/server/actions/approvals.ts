"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import {
  approvalRequests,
  approvalSteps,
  requisitions,
  purchaseOrders,
} from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Map entity type → permission required to approve it
export const ENTITY_APPROVE_PERM: Record<string, string> = {
  requisition: "scm:requisition:approve",
  purchase_order: "scm:po:approve",
};

// Revalidate paths affected by approval decisions
const ENTITY_REVALIDATE: Record<string, string[]> = {
  requisition: ["/app/procurement/requisitions", "/app/approvals"],
  purchase_order: ["/app/procurement/purchase-orders", "/app/approvals"],
};

export async function decideApprovalStepAction(
  stepId: string,
  decision: "approved" | "rejected",
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(stepId)) return { success: false, error: "Invalid step ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let entityType = "";
  let entityId = "";
  let errorMsg: string | null = null;

  try {
    await withTenantRLS(ctx, async (tx) => {
      // Fetch step and its request (join through tenant_id on request)
      const [step] = await tx
        .select({
          stepId: approvalSteps.id,
          stepStatus: approvalSteps.status,
          requestId: approvalSteps.requestId,
        })
        .from(approvalSteps)
        .where(eq(approvalSteps.id, stepId))
        .limit(1);

      if (!step) { errorMsg = "Approval step not found."; return; }
      if (step.stepStatus !== "pending") {
        errorMsg = "This step has already been decided.";
        return;
      }

      const [request] = await tx
        .select({
          id: approvalRequests.id,
          tenantId: approvalRequests.tenantId,
          entity: approvalRequests.entity,
          entityId: approvalRequests.entityId,
          status: approvalRequests.status,
          requestedBy: approvalRequests.requestedBy,
        })
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.id, step.requestId),
            eq(approvalRequests.tenantId, user.tenant_id)
          )
        )
        .limit(1);

      if (!request) { errorMsg = "Approval request not found."; return; }
      if (request.status !== "pending") {
        errorMsg = "This approval request is already closed.";
        return;
      }
      if (request.requestedBy && request.requestedBy === user.sub) {
        errorMsg = "You cannot approve a request you submitted.";
        return;
      }

      // Check permission
      const requiredPerm = ENTITY_APPROVE_PERM[request.entity];
      if (!requiredPerm || !user.permissions.includes(requiredPerm)) {
        errorMsg = "You do not have permission to approve this document.";
        return;
      }

      entityType = request.entity;
      entityId = request.entityId;

      // Update the step
      await tx
        .update(approvalSteps)
        .set({ status: decision, comment: comment ?? null, actedAt: new Date() })
        .where(eq(approvalSteps.id, stepId));

      // Only close the request when rejected OR all steps are now decided
      let requestStatus: "pending" | "approved" | "rejected" = "pending";
      if (decision === "rejected") {
        requestStatus = "rejected";
      } else {
        const remaining = await tx
          .select({ id: approvalSteps.id })
          .from(approvalSteps)
          .where(
            and(
              eq(approvalSteps.requestId, request.id),
              eq(approvalSteps.status, "pending")
            )
          );
        if (remaining.length === 0) requestStatus = "approved";
      }

      await tx
        .update(approvalRequests)
        .set({ status: requestStatus, updatedAt: new Date() })
        .where(eq(approvalRequests.id, request.id));

      // Only update the source entity when the request reaches a terminal state
      if (requestStatus === "pending") return;

      // Update the source entity status
      if (request.entity === "requisition") {
        await tx
          .update(requisitions)
          .set({ status: decision === "approved" ? "approved" : "rejected" })
          .where(
            and(
              eq(requisitions.id, request.entityId),
              eq(requisitions.tenantId, user.tenant_id)
            )
          );
      } else if (request.entity === "purchase_order") {
        await tx
          .update(purchaseOrders)
          .set({
            status: decision === "approved" ? "approved" : "cancelled",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(purchaseOrders.id, request.entityId),
              eq(purchaseOrders.tenantId, user.tenant_id)
            )
          );
      }
    });
  } catch {
    return { success: false, error: "Failed to record decision." };
  }

  if (errorMsg) return { success: false, error: errorMsg };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "approval_steps",
      entityId: stepId,
      action: `approval_${decision}`,
      changes: { decision, comment, entityType, entityId },
    });
  } catch {
    // non-fatal
  }

  for (const path of ENTITY_REVALIDATE[entityType] ?? ["/app/approvals"]) {
    revalidatePath(path);
  }

  return { success: true };
}
