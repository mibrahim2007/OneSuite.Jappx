import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { accounts, accountGroups } from "@/lib/db/schema";
import { CoaTable } from "@/components/app/accounts/coa-table";

export default async function ChartOfAccountsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/accounts/chart-of-accounts");
  }

  const permError = requirePermission("accounts:coa:view", user);
  if (permError) redirect("/app/dashboard");

  const [accountRows, groupRows] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(eq(accounts.tenantId, user.tenant_id))
      .orderBy(asc(accounts.code)),
    db
      .select()
      .from(accountGroups)
      .where(eq(accountGroups.tenantId, user.tenant_id))
      .orderBy(asc(accountGroups.name)),
  ]);

  const canCreate = user.permissions.includes("accounts:coa:create");
  const canEdit = user.permissions.includes("accounts:coa:update");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage your organization&apos;s account codes, groups, and types.
      </p>
      <div className="mt-6">
        <CoaTable
          accounts={accountRows}
          groups={groupRows}
          canCreate={canCreate}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
