import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { requisitions, items } from "@/lib/db/schema";
import { RequisitionsTable } from "@/components/app/procurement/requisitions-table";

export default async function RequisitionsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/procurement/requisitions");
  }

  const permError = requirePermission("scm:requisition:view", user);
  if (permError) redirect("/app/dashboard");

  const [rows, activeItems] = await Promise.all([
    db
      .select()
      .from(requisitions)
      .where(eq(requisitions.tenantId, user.tenant_id))
      .orderBy(desc(requisitions.reqDate), desc(requisitions.id))
      .limit(200),
    db
      .select({ id: items.id, sku: items.sku, name: items.name })
      .from(items)
      .where(
        and(
          eq(items.tenantId, user.tenant_id),
          eq(items.isActive, true),
          isNull(items.deletedAt)
        )
      )
      .orderBy(items.sku),
  ]);

  const canCreate = user.permissions.includes("scm:requisition:create");
  const canApprove = user.permissions.includes("scm:requisition:approve");

  return (
    <div className="p-6">
      <RequisitionsTable
        requisitions={rows}
        activeItems={activeItems}
        canCreate={canCreate}
        canApprove={canApprove}
      />
    </div>
  );
}
