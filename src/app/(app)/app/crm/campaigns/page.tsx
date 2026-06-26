import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { CampaignsView } from "@/components/app/crm/campaigns-view";

export default async function CampaignsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/campaigns");
  }

  const permError = requirePermission("crm:lead:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, user.tenant_id))
    .orderBy(desc(campaigns.createdAt));

  const canManage = user.permissions.includes("crm:campaign:manage");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <p className="text-sm text-muted-foreground mt-1">Email and marketing campaigns with lead segmentation.</p>
      <div className="mt-6">
        <CampaignsView campaigns={rows} canManage={canManage} />
      </div>
    </div>
  );
}
