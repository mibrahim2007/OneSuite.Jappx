import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { pmSchedules, assets } from "@/lib/db/schema";
import { PmSchedulesTable } from "@/components/app/maintenance/pm-schedules-table";

export default async function PmSchedulesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/rm/pm-schedules");
  }

  const permError = requirePermission("rm:pm:view", user);
  if (permError) redirect("/app/dashboard");

  const [scheduleRows, assetRows] = await Promise.all([
    db
      .select()
      .from(pmSchedules)
      .where(eq(pmSchedules.tenantId, user.tenant_id))
      .orderBy(asc(pmSchedules.nextDueDate)),
    db
      .select({ id: assets.id, code: assets.code, name: assets.name })
      .from(assets)
      .where(eq(assets.tenantId, user.tenant_id))
      .orderBy(asc(assets.code)),
  ]);

  const canCreate = user.permissions.includes("rm:pm:create");
  const canEdit = user.permissions.includes("rm:pm:update");
  const canGenerateWo = user.permissions.includes("rm:workorder:create");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">PM Schedules</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Preventive maintenance schedules per asset.
      </p>
      <div className="mt-6">
        <PmSchedulesTable
          schedules={scheduleRows}
          assets={assetRows}
          canCreate={canCreate}
          canEdit={canEdit}
          canGenerateWo={canGenerateWo}
        />
      </div>
    </div>
  );
}
