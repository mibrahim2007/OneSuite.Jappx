import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { FleetGlPostingView } from "@/components/app/fleet/fleet-gl-posting-view";

export default async function FleetGlPostingPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/gl-posting");
  }

  const permError = requirePermission("accounts:journal:create", user);
  if (permError) redirect("/app/dashboard");

  // Fetch completed/closed WOs without journal_id
  const unpostedWOs = await db
    .select({
      id: workOrders.id,
      woNo: workOrders.woNo,
      title: workOrders.title,
      status: workOrders.status,
      totalCost: workOrders.totalCost,
      completedAt: workOrders.completedAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.tenantId, user.tenant_id),
        isNull(workOrders.journalId),
      )
    )
    .orderBy(workOrders.completedAt);

  const completedUnposted = unpostedWOs.filter(
    (wo) => wo.status === "completed" || wo.status === "closed"
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Fleet & Maintenance GL Posting</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Post fleet fuel costs and work order costs to the General Ledger.
      </p>
      <FleetGlPostingView unpostedWOs={completedUnposted} />
    </div>
  );
}
