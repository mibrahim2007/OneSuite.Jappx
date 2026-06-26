import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { assets, warehouses } from "@/lib/db/schema";
import { AssetsTable } from "@/components/app/maintenance/assets-table";

export default async function AssetsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/rm/assets");
  }

  const permError = requirePermission("rm:asset:view", user);
  if (permError) redirect("/app/dashboard");

  const [assetRows, warehouseRows] = await Promise.all([
    db
      .select({
        id: assets.id,
        code: assets.code,
        name: assets.name,
        category: assets.category,
        location: assets.location,
        warehouseId: assets.warehouseId,
        purchaseDate: assets.purchaseDate,
        purchaseCost: assets.purchaseCost,
        warrantyExpiry: assets.warrantyExpiry,
        meterReading: assets.meterReading,
        status: assets.status,
        parentId: assets.parentId,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
      })
      .from(assets)
      .where(eq(assets.tenantId, user.tenant_id))
      .orderBy(asc(assets.code)),
    db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.tenantId, user.tenant_id))
      .orderBy(asc(warehouses.name)),
  ]);

  const canCreate = user.permissions.includes("rm:asset:create");
  const canEdit = user.permissions.includes("rm:asset:update");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Asset Register</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage equipment, machinery, and facilities.
      </p>
      <div className="mt-6">
        <AssetsTable
          assets={assetRows}
          warehouses={warehouseRows}
          canCreate={canCreate}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
