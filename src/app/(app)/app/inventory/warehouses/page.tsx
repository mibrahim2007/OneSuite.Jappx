import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { warehouses } from "@/lib/db/schema";
import { WarehousesTable } from "@/components/app/inventory/warehouses-table";

export default async function WarehousesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/inventory/warehouses");
  }

  const permError = requirePermission("scm:inventory:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.tenantId, user.tenant_id))
    .orderBy(asc(warehouses.code));

  const canManage = user.permissions.includes("scm:inventory:adjust");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Warehouses</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Define storage locations for tracking stock by physical site.
      </p>
      <div className="mt-6">
        <WarehousesTable warehouses={rows} canManage={canManage} />
      </div>
    </div>
  );
}
