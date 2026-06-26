import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { quotations, quotationLines, crmCompanies, opportunities } from "@/lib/db/schema";
import { QuotationDetail } from "@/components/app/crm/quotation-detail";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/app/crm/quotations/${id}`);
  }

  const permError = requirePermission("crm:quotation:view", user);
  if (permError) redirect("/app/dashboard");

  const [quot] = await db
    .select({
      id: quotations.id,
      quoteNo: quotations.quoteNo,
      quoteDate: quotations.quoteDate,
      validUntil: quotations.validUntil,
      status: quotations.status,
      subtotal: quotations.subtotal,
      taxTotal: quotations.taxTotal,
      total: quotations.total,
      invoiceId: quotations.invoiceId,
      opportunityId: quotations.opportunityId,
      companyId: quotations.companyId,
      companyName: crmCompanies.name,
      opportunityTitle: opportunities.title,
    })
    .from(quotations)
    .leftJoin(crmCompanies, eq(quotations.companyId, crmCompanies.id))
    .leftJoin(opportunities, eq(quotations.opportunityId, opportunities.id))
    .where(and(eq(quotations.id, id), eq(quotations.tenantId, user.tenant_id)))
    .limit(1);

  if (!quot) notFound();

  const lines = await db
    .select()
    .from(quotationLines)
    .where(and(eq(quotationLines.quotationId, id), eq(quotationLines.tenantId, user.tenant_id)));

  return (
    <div className="p-6 max-w-4xl">
      <QuotationDetail
        quotation={quot}
        lines={lines}
        canApprove={user.permissions.includes("crm:quotation:approve")}
        canInvoice={user.permissions.includes("accounts:invoice:create")}
      />
    </div>
  );
}
