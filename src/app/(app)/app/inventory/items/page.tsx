import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { items, itemCategories, uoms, accounts } from "@/lib/db/schema";
import { ItemsTable } from "@/components/app/inventory/items-table";

export default async function ItemsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/inventory/items");
  }

  const permError = requirePermission("scm:item:view", user);
  if (permError) redirect("/app/dashboard");

  const [itemRows, categoryRows, uomRows, accountRows] = await Promise.all([
    db
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        categoryId: items.categoryId,
        uomId: items.uomId,
        barcode: items.barcode,
        isStock: items.isStock,
        valuation: items.valuation,
        purchasePrice: items.purchasePrice,
        salePrice: items.salePrice,
        reorderLevel: items.reorderLevel,
        inventoryAccountId: items.inventoryAccountId,
        isActive: items.isActive,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        deletedAt: items.deletedAt,
        categoryName: itemCategories.name,
        uomCode: uoms.code,
      })
      .from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(uoms, eq(items.uomId, uoms.id))
      .where(and(eq(items.tenantId, user.tenant_id), isNull(items.deletedAt)))
      .orderBy(asc(items.sku)),
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
    db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isActive, true)))
      .orderBy(asc(accounts.code)),
  ]);

  const canCreate = user.permissions.includes("scm:item:create");
  const canEdit = user.permissions.includes("scm:item:update");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Items</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage your product and service catalogue.
      </p>
      <div className="mt-6">
        <ItemsTable
          items={itemRows}
          categories={categoryRows}
          uoms={uomRows}
          accounts={accountRows}
          canCreate={canCreate}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
