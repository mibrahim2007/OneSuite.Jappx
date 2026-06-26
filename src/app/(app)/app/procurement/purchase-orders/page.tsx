import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { purchaseOrders, items, contacts, taxRates } from "@/lib/db/schema";
import { PurchaseOrdersTable } from "@/components/app/procurement/purchase-orders-table";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from_req?: string }>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/procurement/purchase-orders");
  }

  const permError = requirePermission("scm:po:view", user);
  if (permError) redirect("/app/dashboard");

  const { from_req: fromReqId } = await searchParams;

  const [rows, activeVendors, activeItems, activeTaxRates] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        poNo: purchaseOrders.poNo,
        vendorId: purchaseOrders.vendorId,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        subtotal: purchaseOrders.subtotal,
        taxTotal: purchaseOrders.taxTotal,
        total: purchaseOrders.total,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        vendorName: contacts.name,
      })
      .from(purchaseOrders)
      .leftJoin(contacts, eq(purchaseOrders.vendorId, contacts.id))
      .where(eq(purchaseOrders.tenantId, user.tenant_id))
      .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.id))
      .limit(200),
    db
      .select({ id: contacts.id, name: contacts.name, code: contacts.code })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, user.tenant_id),
          eq(contacts.type, "vendor"),
          eq(contacts.isActive, true)
        )
      )
      .orderBy(contacts.name),
    db
      .select({ id: items.id, sku: items.sku, name: items.name })
      .from(items)
      .where(
        and(
          eq(items.tenantId, user.tenant_id),
          eq(items.isActive, true),
          isNull(items.deletedAt)
        )
      )
      .orderBy(items.sku),
    db
      .select({ id: taxRates.id, name: taxRates.name, rate: taxRates.rate })
      .from(taxRates)
      .where(and(eq(taxRates.tenantId, user.tenant_id), eq(taxRates.isActive, true)))
      .orderBy(taxRates.name),
  ]);

  const canCreate = user.permissions.includes("scm:po:create");
  const canApprove = user.permissions.includes("scm:po:approve");

  return (
    <div className="p-6">
      <PurchaseOrdersTable
        pos={rows}
        activeVendors={activeVendors}
        activeItems={activeItems}
        activeTaxRates={activeTaxRates}
        canCreate={canCreate}
        canApprove={canApprove}
        fromReqId={fromReqId ?? null}
      />
    </div>
  );
}
