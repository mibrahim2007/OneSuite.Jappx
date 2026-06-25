import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { fiscalPeriods } from "@/lib/db/schema";
import { tenants } from "@/lib/db/schema/platform";
import { FiscalPeriodsView } from "@/components/app/accounts/fiscal-periods-view";

export default async function FiscalPeriodsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/fiscal-periods");
  }

  const permError = requirePermission("accounts:period:view", user);
  if (permError) redirect("/app/dashboard");

  const [periods, tenantRows] = await Promise.all([
    db
      .select()
      .from(fiscalPeriods)
      .where(eq(fiscalPeriods.tenantId, user.tenant_id))
      .orderBy(asc(fiscalPeriods.startDate), asc(fiscalPeriods.periodNum)),
    db
      .select({ fiscalStartMonth: tenants.fiscalStartMonth })
      .from(tenants)
      .where(eq(tenants.id, user.tenant_id))
      .limit(1),
  ]);

  const fiscalStartMonth = tenantRows[0]?.fiscalStartMonth ?? 1;
  const canCreate = user.permissions.includes("accounts:period:create");
  const canClose = user.permissions.includes("accounts:period:close");
  const canLock = user.permissions.includes("accounts:period:lock");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Fiscal Periods</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage fiscal years and accounting periods.
      </p>
      <div className="mt-6">
        <FiscalPeriodsView
          periods={periods}
          fiscalStartMonth={fiscalStartMonth}
          canCreate={canCreate}
          canClose={canClose}
          canLock={canLock}
        />
      </div>
    </div>
  );
}
