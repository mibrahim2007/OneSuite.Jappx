import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, and, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { accounts, fiscalPeriods } from "@/lib/db/schema";
import { JournalEntryForm } from "@/components/app/accounts/journal-entry-form";

export default async function NewJournalEntryPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/journal-entries/new");
  }

  const permError = requirePermission("accounts:journal:post", user);
  if (permError) redirect("/app/accounts/journal-entries");

  const [accountRows, periodRows] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, user.tenant_id),
          eq(accounts.isActive, true)
        )
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
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">New Journal Entry</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Post a balanced double-entry journal voucher.
      </p>
      <div className="mt-6">
        <JournalEntryForm accounts={accountRows} openPeriods={periodRows} />
      </div>
    </div>
  );
}
