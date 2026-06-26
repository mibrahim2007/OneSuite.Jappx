import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { ActivitiesTable } from "@/components/app/crm/activities-table";

export default async function ActivitiesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/activities");
  }

  const permError = requirePermission("crm:activity:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.tenantId, user.tenant_id))
    .orderBy(desc(activities.createdAt));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Activities</h1>
      <p className="text-sm text-muted-foreground mt-1">Calls, meetings, tasks, and notes.</p>
      <div className="mt-6">
        <ActivitiesTable
          activities={rows}
          canCreate={user.permissions.includes("crm:activity:create")}
        />
      </div>
    </div>
  );
}
