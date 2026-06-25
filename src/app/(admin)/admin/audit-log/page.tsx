import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { AuditLogFilters } from "@/components/admin/audit-log/audit-log-filters";
import { AuditLogTable } from "@/components/admin/audit-log/audit-log-table";

const PAGE_SIZE = 50;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    entity?: string;
    action?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    redirect(`/api/auth/refresh?next=/admin/audit-log`);
  }

  if (!user.permissions.includes("admin:audit_log:view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const filters = {
    entity: params.entity || undefined,
    action: params.action || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };

  const conditions = [eq(auditLogs.tenantId, user.tenant_id)];
  if (filters.entity) conditions.push(eq(auditLogs.entity, filters.entity));
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.from) {
    conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(auditLogs.createdAt, toDate));
  }

  const whereClause = and(...conditions);

  const [countResult, rows, entityOptions, actionOptions] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause),

    db
      .select({
        id: auditLogs.id,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        changes: auditLogs.changes,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userFullName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db
      .selectDistinct({ value: auditLogs.entity })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, user.tenant_id))
      .orderBy(auditLogs.entity),

    db
      .selectDistinct({ value: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, user.tenant_id))
      .orderBy(auditLogs.action),
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Immutable record of all system events for your organization.
        </p>
      </div>

      <AuditLogFilters
        current={filters}
        entityOptions={entityOptions.map((r) => r.value)}
        actionOptions={actionOptions.map((r) => r.value)}
      />

      <AuditLogTable
        rows={rows}
        page={page}
        totalPages={totalPages}
        total={total}
        filters={filters}
      />
    </div>
  );
}
