import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { grns, purchaseOrders, warehouses, items, poLines, grnLines } from "@/lib/db/schema";
import { GrnsTable } from "@/components/app/procurement/grns-table";

export default async function GrnsPage({
  searchParams,
}: {
  searchParams: Promise<{ from_po?: string }>;
}) {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/procurement/grns");
  }

  const permError = requirePermission("scm:grn:view", user);
  if (permError) redirect("/app/dashboard");

  const { from_po: fromPoId } = await searchParams;

  const [rows, activeWarehouses, activeItems] = await Promise.all([
    db
      .select({
        id: grns.id,
        grnNo: grns.grnNo,
        poId: grns.poId,
        warehouseId: grns.warehouseId,
        receiptDate: grns.receiptDate,
        status: grns.status,
        createdAt: grns.createdAt,
        poNo: purchaseOrders.poNo,
        warehouseName: warehouses.name,
      })
      .from(grns)
      .leftJoin(purchaseOrders, eq(grns.poId, purchaseOrders.id))
      .leftJoin(warehouses, eq(grns.warehouseId, warehouses.id))
      .where(eq(grns.tenantId, user.tenant_id))
      .orderBy(desc(grns.receiptDate), desc(grns.id))
      .limit(200),
    db
      .select({ id: warehouses.id, name: warehouses.name, code: warehouses.code })
      .from(warehouses)
      .where(and(eq(warehouses.tenantId, user.tenant_id), eq(warehouses.isActive, true)))
      .orderBy(warehouses.code),
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
  ]);

  // If creating a GRN from a PO, pre-fetch PO lines for the dialog
  let fromPoLines: Array<{
    id: string;
    itemId: string;
    quantity: string;
    unitPrice: string;
    itemSku: string;
    itemName: string;
  }> = [];

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (fromPoId && UUID_RE.test(fromPoId)) {
    fromPoLines = await db
      .select({
        id: poLines.id,
        itemId: poLines.itemId,
        quantity: poLines.quantity,
        unitPrice: poLines.unitPrice,
        itemSku: items.sku,
        itemName: items.name,
      })
      .from(poLines)
      .innerJoin(items, eq(poLines.itemId, items.id))
      .where(and(eq(poLines.poId, fromPoId), eq(poLines.tenantId, user.tenant_id)));
  }

  const canCreate = user.permissions.includes("scm:grn:create");

  return (
    <div className="p-6">
      <GrnsTable
        grns={rows}
        activeWarehouses={activeWarehouses}
        activeItems={activeItems}
        canCreate={canCreate}
        fromPoId={fromPoId ?? null}
        fromPoLines={fromPoLines}
      />
    </div>
  );
}
