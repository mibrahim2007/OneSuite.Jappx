import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { crmCompanies, opportunities, items } from "@/lib/db/schema";
import { QuotationForm } from "@/components/app/crm/quotation-form";

export default async function NewQuotationPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/quotations/new");
  }

  const permError = requirePermission("crm:quotation:create", user);
  if (permError) redirect("/app/dashboard");

  const [companies, opps, itemRows] = await Promise.all([
    db
      .select({ id: crmCompanies.id, name: crmCompanies.name })
      .from(crmCompanies)
      .where(eq(crmCompanies.tenantId, user.tenant_id))
      .orderBy(asc(crmCompanies.name)),
    db
      .select({ id: opportunities.id, title: opportunities.title })
      .from(opportunities)
      .where(eq(opportunities.tenantId, user.tenant_id))
      .orderBy(asc(opportunities.title)),
    db
      .select({ id: items.id, name: items.name, salePrice: items.salePrice })
      .from(items)
      .where(eq(items.tenantId, user.tenant_id))
      .orderBy(asc(items.name)),
  ]);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">New Quotation</h1>
      <p className="text-sm text-muted-foreground mt-1">Create a sales quotation.</p>
      <div className="mt-6">
        <QuotationForm companies={companies} opportunities={opps} items={itemRows} />
      </div>
    </div>
  );
}
