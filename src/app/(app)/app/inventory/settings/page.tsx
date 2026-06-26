import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { itemCategories, uoms } from "@/lib/db/schema";
import { InventorySettingsView } from "@/components/app/inventory/inventory-settings-view";

export default async function InventorySettingsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/inventory/settings");
  }

  const permError = requirePermission("scm:item:view", user);
  if (permError) redirect("/app/dashboard");

  const [categoryRows, uomRows] = await Promise.all([
    db
      .select()
      .from(itemCategories)
      .where(eq(itemCategories.tenantId, user.tenant_id))
      .orderBy(asc(itemCategories.name)),
    db
      .select()
      .from(uoms)
      .where(eq(uoms.tenantId, user.tenant_id))
      .orderBy(asc(uoms.code)),
  ]);

  const canManage = user.permissions.includes("scm:item:create");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Inventory Settings</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage item categories and units of measure.
      </p>
      <div className="mt-6">
        <InventorySettingsView
          categories={categoryRows}
          uoms={uomRows}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
