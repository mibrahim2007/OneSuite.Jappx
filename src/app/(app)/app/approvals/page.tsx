import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { approvalRequests, approvalSteps } from "@/lib/db/schema";
import { ENTITY_APPROVE_PERM } from "@/lib/approvals-config";
import { ApprovalsInbox } from "@/components/app/approvals/approvals-inbox";

export default async function ApprovalsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/approvals");
  }

  // Fetch all pending steps for this tenant
  const allPending = await db
    .select({
      stepId: approvalSteps.id,
      stepNo: approvalSteps.stepNo,
      requestId: approvalRequests.id,
      entity: approvalRequests.entity,
      entityId: approvalRequests.entityId,
      requestedBy: approvalRequests.requestedBy,
      createdAt: approvalRequests.createdAt,
    })
    .from(approvalSteps)
    .innerJoin(
      approvalRequests,
      eq(approvalSteps.requestId, approvalRequests.id)
    )
    .where(
      and(
        eq(approvalRequests.tenantId, user.tenant_id),
        eq(approvalSteps.status, "pending"),
        eq(approvalRequests.status, "pending")
      )
    )
    .orderBy(approvalRequests.createdAt);

  // Filter to entity types the current user has approve permission for
  const pending = allPending.filter((row) => {
    const perm = ENTITY_APPROVE_PERM[row.entity];
    return perm && user.permissions.includes(perm);
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Approvals Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Documents pending your approval decision.
        </p>
      </div>
      <ApprovalsInbox pending={pending} />
    </div>
  );
}
