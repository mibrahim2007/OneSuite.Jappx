import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { ActivityTimeline } from "@/components/app/activity-timeline";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/activity");
  }

  const params = await searchParams;
  const entityFilter = params.entity ?? "";
  const actionFilter = params.action ?? "";

  const conditions = [eq(auditLogs.tenantId, user.tenant_id)];
  if (entityFilter) conditions.push(eq(auditLogs.entity, entityFilter));
  if (actionFilter) conditions.push(eq(auditLogs.action, actionFilter));

  const entries = await db
    .select({
      id: auditLogs.id,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      userName: users.fullName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  // Collect distinct entity types for filter dropdown
  const allEntities = await db
    .selectDistinct({ entity: auditLogs.entity })
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, user.tenant_id))
    .orderBy(auditLogs.entity)
    .limit(50);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Audit trail of all changes in your workspace.
        </p>
      </div>
      <ActivityTimeline
        entries={entries}
        entityTypes={allEntities.map((r) => r.entity)}
        currentEntity={entityFilter}
        currentAction={actionFilter}
      />
    </div>
  );
}
