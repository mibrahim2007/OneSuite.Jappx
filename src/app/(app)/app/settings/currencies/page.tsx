import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { currencies, exchangeRates } from "@/lib/db/schema";
import { CurrenciesView } from "@/components/app/multicurrency/currencies-view";

export default async function CurrenciesPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/settings/currencies");
  }

  const permError = requirePermission("admin:settings:view", user);
  if (permError) redirect("/app/dashboard");

  const canManage = user.permissions.includes("admin:settings:update");

  const [currencyList, rateList] = await Promise.all([
    db
      .select()
      .from(currencies)
      .where(eq(currencies.tenantId, user.tenant_id))
      .orderBy(currencies.code),
    db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.tenantId, user.tenant_id))
      .orderBy(desc(exchangeRates.effectiveDate)),
  ]);

  return (
    <CurrenciesView
      currencies={currencyList}
      exchangeRates={rateList}
      canManage={canManage}
    />
  );
}
