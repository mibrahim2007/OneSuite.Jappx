import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { vehicleDocuments, vehicles } from "@/lib/db/schema";
import { ComplianceAlerts } from "@/components/app/fleet/compliance-alerts";

export default async function AlertsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/fleet/alerts");
  }

  const permError = requirePermission("fleet:compliance:view", user);
  if (permError) redirect("/app/dashboard");

  const [docRows, vehicleOptions] = await Promise.all([
    db
      .select({
        id: vehicleDocuments.id,
        vehicleId: vehicleDocuments.vehicleId,
        regNumber: vehicles.regNumber,
        docType: vehicleDocuments.docType,
        docNumber: vehicleDocuments.docNumber,
        issueDate: vehicleDocuments.issueDate,
        expiryDate: vehicleDocuments.expiryDate,
        alertDays: vehicleDocuments.alertDays,
      })
      .from(vehicleDocuments)
      .leftJoin(vehicles, eq(vehicleDocuments.vehicleId, vehicles.id))
      .where(eq(vehicleDocuments.tenantId, user.tenant_id))
      .orderBy(asc(vehicleDocuments.expiryDate)),

    db
      .select({ id: vehicles.id, regNumber: vehicles.regNumber })
      .from(vehicles)
      .where(eq(vehicles.tenantId, user.tenant_id))
      .orderBy(asc(vehicles.regNumber)),
  ]);

  const rows = docRows.map((r) => ({
    ...r,
    regNumber: r.regNumber ?? "",
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Compliance Alerts</h1>
      <p className="text-sm text-muted-foreground mt-1">Track document expiries for vehicles.</p>
      <div className="mt-6">
        <ComplianceAlerts
          documents={rows}
          vehicles={vehicleOptions}
          canManage={user.permissions.includes("fleet:compliance:manage")}
        />
      </div>
    </div>
  );
}
