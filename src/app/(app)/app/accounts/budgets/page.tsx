import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { budgets } from "@/lib/db/schema";
import { BudgetsTable } from "@/components/app/accounts/budgets-table";

export default async function BudgetsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try { user = await verifyAccessToken(token); }
  catch { redirect("/api/auth/refresh?next=/app/accounts/budgets"); }

  const permError = requirePermission("accounts:report:view", user);
  if (permError) redirect("/app/dashboard");

  const rows = await db
    .select()
    .from(budgets)
    .where(eq(budgets.tenantId, user.tenant_id))
    .orderBy(budgets.fiscalYear);

  const canCreate = user.permissions.includes("accounts:budget:create");
  const canUpdate = user.permissions.includes("accounts:budget:update");

  return <BudgetsTable budgets={rows} canCreate={canCreate} canUpdate={canUpdate} />;
}
