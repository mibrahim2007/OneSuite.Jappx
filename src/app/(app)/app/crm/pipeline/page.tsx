import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { pipelineStages, opportunities, crmCompanies, crmContacts } from "@/lib/db/schema";
import { PipelineView } from "@/components/app/crm/pipeline-view";

export default async function PipelinePage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/pipeline");
  }

  const permError = requirePermission("crm:opportunity:view", user);
  if (permError) redirect("/app/dashboard");

  const [stages, opps, companies, contacts] = await Promise.all([
    db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.tenantId, user.tenant_id))
      .orderBy(asc(pipelineStages.sortOrder)),
    db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        stageId: opportunities.stageId,
        companyId: opportunities.companyId,
        contactId: opportunities.contactId,
        amount: opportunities.amount,
        currency: opportunities.currency,
        expectedClose: opportunities.expectedClose,
        isWon: opportunities.isWon,
        closedAt: opportunities.closedAt,
        createdAt: opportunities.createdAt,
        companyName: crmCompanies.name,
        contactName: crmContacts.fullName,
      })
      .from(opportunities)
      .leftJoin(crmCompanies, eq(opportunities.companyId, crmCompanies.id))
      .leftJoin(crmContacts, eq(opportunities.contactId, crmContacts.id))
      .where(eq(opportunities.tenantId, user.tenant_id))
      .orderBy(asc(opportunities.createdAt)),
    db
      .select({ id: crmCompanies.id, name: crmCompanies.name })
      .from(crmCompanies)
      .where(eq(crmCompanies.tenantId, user.tenant_id))
      .orderBy(asc(crmCompanies.name)),
    db
      .select({ id: crmContacts.id, fullName: crmContacts.fullName })
      .from(crmContacts)
      .where(eq(crmContacts.tenantId, user.tenant_id))
      .orderBy(asc(crmContacts.fullName)),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Pipeline</h1>
      <p className="text-sm text-muted-foreground mt-1">Track opportunities by stage.</p>
      <div className="mt-6">
        <PipelineView
          stages={stages}
          opportunities={opps}
          companies={companies}
          contacts={contacts}
          canCreate={user.permissions.includes("crm:opportunity:create")}
          canEdit={user.permissions.includes("crm:opportunity:update")}
        />
      </div>
    </div>
  );
}
