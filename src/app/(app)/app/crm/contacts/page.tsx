import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { crmContacts, crmCompanies } from "@/lib/db/schema";
import { CrmContactsTable } from "@/components/app/crm/crm-contacts-table";

export default async function CrmContactsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/contacts");
  }

  const permError = requirePermission("crm:contact:view", user);
  if (permError) redirect("/app/dashboard");

  const [contacts, companies] = await Promise.all([
    db
      .select({
        id: crmContacts.id,
        fullName: crmContacts.fullName,
        email: crmContacts.email,
        phone: crmContacts.phone,
        designation: crmContacts.designation,
        companyId: crmContacts.companyId,
        companyName: crmCompanies.name,
        createdAt: crmContacts.createdAt,
      })
      .from(crmContacts)
      .leftJoin(crmCompanies, eq(crmContacts.companyId, crmCompanies.id))
      .where(eq(crmContacts.tenantId, user.tenant_id))
      .orderBy(asc(crmContacts.fullName)),
    db
      .select({ id: crmCompanies.id, name: crmCompanies.name })
      .from(crmCompanies)
      .where(eq(crmCompanies.tenantId, user.tenant_id))
      .orderBy(asc(crmCompanies.name)),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Contacts</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage CRM contacts and people.</p>
      <div className="mt-6">
        <CrmContactsTable
          contacts={contacts}
          companies={companies}
          canCreate={user.permissions.includes("crm:contact:create")}
          canEdit={user.permissions.includes("crm:contact:update")}
        />
      </div>
    </div>
  );
}
