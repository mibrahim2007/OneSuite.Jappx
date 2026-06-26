import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { quotations, crmCompanies } from "@/lib/db/schema";
import { QuotationsList } from "@/components/app/crm/quotations-list";

export default async function QuotationsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/crm/quotations");
  }

  const permError = requirePermission("crm:quotation:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      id: quotations.id,
      quoteNo: quotations.quoteNo,
      quoteDate: quotations.quoteDate,
      validUntil: quotations.validUntil,
      status: quotations.status,
      subtotal: quotations.subtotal,
      total: quotations.total,
      invoiceId: quotations.invoiceId,
      companyName: crmCompanies.name,
    })
    .from(quotations)
    .leftJoin(crmCompanies, eq(quotations.companyId, crmCompanies.id))
    .where(eq(quotations.tenantId, user.tenant_id))
    .orderBy(desc(quotations.quoteDate));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Quotations</h1>
      <p className="text-sm text-muted-foreground mt-1">Create and manage sales quotations.</p>
      <div className="mt-6">
        <QuotationsList
          quotations={rows}
          canCreate={user.permissions.includes("crm:quotation:create")}
          canApprove={user.permissions.includes("crm:quotation:approve")}
        />
      </div>
    </div>
  );
}
