import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { tenants, taxRates, numberSeries, attachments, users } from "@/lib/db/schema";
import { CompanyForm } from "@/components/admin/settings/company-form";
import { TaxRatesSection } from "@/components/admin/settings/tax-rates-section";
import { NumberSeriesSection } from "@/components/admin/settings/number-series-section";
import { AttachmentPanel } from "@/components/shared/attachments/attachment-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function AdminSettingsPage() {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    redirect(`/api/auth/refresh?next=/admin/settings`);
  }

  if (!user.permissions.includes("admin:settings:view")) {
    redirect("/admin");
  }

  const [[tenant], taxRateRows, seriesRows, attachmentRows] = await Promise.all([
    db
      .select({
        name: tenants.name,
        legalName: tenants.legalName,
        logoUrl: tenants.logoUrl,
        accentColor: tenants.accentColor,
        baseCurrency: tenants.baseCurrency,
        timezone: tenants.timezone,
        fiscalStartMonth: tenants.fiscalStartMonth,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, user.tenant_id))
      .limit(1),

    db
      .select()
      .from(taxRates)
      .where(eq(taxRates.tenantId, user.tenant_id))
      .orderBy(taxRates.name),

    db
      .select()
      .from(numberSeries)
      .where(eq(numberSeries.tenantId, user.tenant_id)),

    db
      .select({
        id: attachments.id,
        tenantId: attachments.tenantId,
        uploadedBy: attachments.uploadedBy,
        entity: attachments.entity,
        entityId: attachments.entityId,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        storagePath: attachments.storagePath,
        createdAt: attachments.createdAt,
        uploaderName: users.fullName,
      })
      .from(attachments)
      .innerJoin(users, eq(users.id, attachments.uploadedBy))
      .where(
        and(
          eq(attachments.tenantId, user.tenant_id),
          eq(attachments.entity, "tenant"),
          eq(attachments.entityId, user.tenant_id)
        )
      )
      .orderBy(attachments.createdAt),
  ]);

  if (!tenant) redirect("/admin");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Configure your organization&apos;s profile, tax rates, and accounting rules.
      </p>

      <Tabs defaultValue="company" className="mt-6">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="tax-rates">Tax Rates</TabsTrigger>
          <TabsTrigger value="numbering">Numbering</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanyForm defaultValues={tenant} />
        </TabsContent>

        <TabsContent value="tax-rates" className="mt-4">
          <TaxRatesSection initialTaxRates={taxRateRows} />
        </TabsContent>

        <TabsContent value="numbering" className="mt-4">
          <NumberSeriesSection initialSeries={seriesRows} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="max-w-2xl">
            <p className="text-sm text-muted-foreground mb-4">
              Attach supporting documents to your organization record (e.g., registration certificate, tax filings).
            </p>
            <AttachmentPanel
              entity="tenant"
              entityId={user.tenant_id}
              initialAttachments={attachmentRows}
              currentUserId={user.sub}
              canAdminDelete={user.permissions.some((p) => p.startsWith("admin:"))}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
