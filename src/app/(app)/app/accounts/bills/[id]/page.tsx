import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  accounts,
  billLines,
  bills,
  contacts,
  fiscalPeriods,
  taxRates,
} from "@/lib/db/schema";
import { BillForm } from "@/components/app/accounts/bill-form";
import { BillDetail } from "@/components/app/accounts/bill-detail";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) redirect("/app/accounts/bills");

  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect(`/api/auth/refresh?next=/app/accounts/bills/${id}`);
  }

  const permError = requirePermission("accounts:bill:view", user);
  if (permError) redirect("/app/dashboard");

  // Fetch bill + lines in parallel
  const [billRows, lineRows] = await Promise.all([
    db
      .select()
      .from(bills)
      .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenant_id)))
      .limit(1),
    db
      .select()
      .from(billLines)
      .where(
        and(eq(billLines.billId, id), eq(billLines.tenantId, user.tenant_id))
      )
      .orderBy(asc(billLines.sortOrder)),
  ]);

  const bill = billRows[0];
  if (!bill) redirect("/app/accounts/bills");

  const canManage =
    user.permissions.includes("accounts:bill:update") ||
    user.permissions.includes("accounts:bill:create");

  // Posted bills → read-only detail view
  if (bill.status !== "draft") {
    return (
      <div className="p-6">
        <BillDetail bill={bill} lines={lineRows} />
      </div>
    );
  }

  // Draft bills with manage permission → editable form
  if (!canManage) {
    return (
      <div className="p-6">
        <BillDetail bill={bill} lines={lineRows} />
      </div>
    );
  }

  // Load form data for edit mode
  const [vendorRows, accountRows, periodRows, taxRateRows] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, user.tenant_id),
          eq(contacts.isActive, true),
          inArray(contacts.type, ["vendor", "both"])
        )
      )
      .orderBy(asc(contacts.name)),
    db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.tenantId, user.tenant_id), eq(accounts.isActive, true))
      )
      .orderBy(asc(accounts.code)),
    db
      .select()
      .from(fiscalPeriods)
      .where(
        and(
          eq(fiscalPeriods.tenantId, user.tenant_id),
          eq(fiscalPeriods.status, "open")
        )
      )
      .orderBy(asc(fiscalPeriods.startDate)),
    db
      .select()
      .from(taxRates)
      .where(
        and(eq(taxRates.tenantId, user.tenant_id), eq(taxRates.isActive, true))
      )
      .orderBy(asc(taxRates.name)),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Edit Bill — {bill.billNo}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Update this draft bill before posting.
      </p>
      <div className="mt-6">
        <BillForm
          vendors={vendorRows}
          accounts={accountRows}
          openPeriods={periodRows}
          taxRates={taxRateRows}
          initialData={{ ...bill, lines: lineRows }}
        />
      </div>
    </div>
  );
}
