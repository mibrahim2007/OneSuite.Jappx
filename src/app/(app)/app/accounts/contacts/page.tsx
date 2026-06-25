import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { ContactsView } from "@/components/app/accounts/contacts-view";

export default async function ContactsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/contacts");
  }

  const permError = requirePermission("accounts:contact:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.tenantId, user.tenant_id))
    .orderBy(asc(contacts.name));

  const canManage = user.permissions.includes("accounts:contact:manage");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Contacts</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage vendors and customers.
      </p>
      <div className="mt-6">
        <ContactsView contacts={rows} canManage={canManage} />
      </div>
    </div>
  );
}
