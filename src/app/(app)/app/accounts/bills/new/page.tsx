import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { accounts, contacts, fiscalPeriods, taxRates } from "@/lib/db/schema";
import { BillForm } from "@/components/app/accounts/bill-form";

export default async function NewBillPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/bills/new");
  }

  const permError = requirePermission("accounts:bill:create", user);
  if (permError) redirect("/app/accounts/bills");

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
      <h1 className="text-2xl font-semibold">New Vendor Bill</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Record a vendor bill and post it to accounts payable.
      </p>
      <div className="mt-6">
        <BillForm
          vendors={vendorRows}
          accounts={accountRows}
          openPeriods={periodRows}
          taxRates={taxRateRows}
        />
      </div>
    </div>
  );
}
