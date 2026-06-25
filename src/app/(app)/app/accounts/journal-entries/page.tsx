import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { journals, fiscalPeriods } from "@/lib/db/schema";
import { JournalEntriesList } from "@/components/app/accounts/journal-entries-list";

export default async function JournalEntriesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/journal-entries");
  }

  const permError = requirePermission("accounts:journal:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select({
      journal: journals,
      periodName: fiscalPeriods.name,
    })
    .from(journals)
    .leftJoin(fiscalPeriods, eq(journals.periodId, fiscalPeriods.id))
    .where(eq(journals.tenantId, user.tenant_id))
    .orderBy(desc(journals.createdAt))
    .limit(200);

  const canPost = user.permissions.includes("accounts:journal:post");
  const canVoid = user.permissions.includes("accounts:journal:void");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Journal Entries</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manual double-entry journal vouchers.
      </p>
      <div className="mt-6">
        <JournalEntriesList rows={rows} canPost={canPost} canVoid={canVoid} />
      </div>
    </div>
  );
}
