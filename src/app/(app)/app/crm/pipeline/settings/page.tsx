import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { pipelineStages } from "@/lib/db/schema";
import { PipelineSettings } from "@/components/app/crm/pipeline-settings";

export default async function PipelineSettingsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/pipeline/settings");
  }

  const permError = requirePermission("crm:opportunity:create", user);
  if (permError) redirect("/app/dashboard");

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.tenantId, user.tenant_id))
    .orderBy(asc(pipelineStages.sortOrder));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Pipeline Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage pipeline stages.</p>
      <div className="mt-6">
        <PipelineSettings stages={stages} />
      </div>
    </div>
  );
}
