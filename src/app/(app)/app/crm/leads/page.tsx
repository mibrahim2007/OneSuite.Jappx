import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { LeadsTable } from "@/components/app/crm/leads-table";

export default async function LeadsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/leads");
  }

  const permError = requirePermission("crm:lead:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.tenantId, user.tenant_id))
    .orderBy(asc(leads.createdAt));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <p className="text-sm text-muted-foreground mt-1">Track and qualify incoming leads.</p>
      <div className="mt-6">
        <LeadsTable
          leads={rows}
          canCreate={user.permissions.includes("crm:lead:create")}
          canEdit={user.permissions.includes("crm:lead:update")}
          canDelete={user.permissions.includes("crm:lead:delete")}
        />
      </div>
    </div>
  );
}
