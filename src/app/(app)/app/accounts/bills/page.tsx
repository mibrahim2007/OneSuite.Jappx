import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { bills, contacts } from "@/lib/db/schema";
import { BillsList } from "@/components/app/accounts/bills-list";

export default async function BillsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/bills");
  }

  const permError = requirePermission("accounts:bill:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      id: bills.id,
      tenantId: bills.tenantId,
      vendorId: bills.vendorId,
      billNo: bills.billNo,
      billDate: bills.billDate,
      dueDate: bills.dueDate,
      periodId: bills.periodId,
      reference: bills.reference,
      notes: bills.notes,
      status: bills.status,
      subtotal: bills.subtotal,
      taxAmount: bills.taxAmount,
      total: bills.total,
      payableAccountId: bills.payableAccountId,
      journalId: bills.journalId,
      createdBy: bills.createdBy,
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
      vendorName: contacts.name,
    })
    .from(bills)
    .innerJoin(contacts, eq(bills.vendorId, contacts.id))
    .where(
      and(
        eq(bills.tenantId, user.tenant_id),
        eq(contacts.tenantId, user.tenant_id)
      )
    )
    .orderBy(desc(bills.createdAt));

  const canCreate = user.permissions.includes("accounts:bill:create");
  const canManage = user.permissions.includes("accounts:bill:update");
  const canDelete = user.permissions.includes("accounts:bill:delete");

  return (
    <div className="p-6">
      <BillsList bills={rows} canCreate={canCreate} canManage={canManage} canDelete={canDelete} />
    </div>
  );
}
