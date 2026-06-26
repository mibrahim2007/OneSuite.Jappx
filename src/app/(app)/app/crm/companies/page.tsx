import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { crmCompanies, crmContacts } from "@/lib/db/schema";
import { CompaniesTable } from "@/components/app/crm/companies-table";

export default async function CompaniesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/companies");
  }

  const permError = requirePermission("crm:contact:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      id: crmCompanies.id,
      name: crmCompanies.name,
      industry: crmCompanies.industry,
      website: crmCompanies.website,
      createdAt: crmCompanies.createdAt,
    })
    .from(crmCompanies)
    .where(eq(crmCompanies.tenantId, user.tenant_id))
    .orderBy(asc(crmCompanies.name));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Companies</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage CRM companies and accounts.</p>
      <div className="mt-6">
        <CompaniesTable
          companies={rows}
          canCreate={user.permissions.includes("crm:contact:create")}
          canEdit={user.permissions.includes("crm:contact:update")}
        />
      </div>
    </div>
  );
}
