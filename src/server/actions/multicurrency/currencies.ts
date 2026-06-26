"use server";

import { revalidatePath } from "next/cache";
import { and, eq, lte, desc } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { currencies, exchangeRates } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";
import { currencySchema, exchangeRateSchema } from "@/lib/validations/multicurrency";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionResult = { success: boolean; error?: string };

export async function createCurrencyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("admin:settings:update", user);
  if (perm) return { success: false, error: perm.error };

  const parsed = currencySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    symbol: formData.get("symbol") ?? "",
    isBase: formData.get("isBase") === "true",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(currencies).values({
        tenantId: user.tenant_id,
        ...parsed.data,
      });
    });
  } catch {
    return { success: false, error: "Failed to create currency." };
  }

  try { await createAuditLog({ action: "create", entity: "currency", entityId: parsed.data.code, userId: user.sub, tenantId: user.tenant_id }); } catch {}
  revalidatePath("/app/settings/currencies");
  return { success: true };
}

export async function toggleCurrencyActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid ID." };
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("admin:settings:update", user);
  if (perm) return { success: false, error: perm.error };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(currencies)
        .set({ isActive })
        .where(and(eq(currencies.id, id), eq(currencies.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update currency." };
  }

  revalidatePath("/app/settings/currencies");
  return { success: true };
}

export async function addExchangeRateAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const perm = requirePermission("admin:settings:update", user);
  if (perm) return { success: false, error: perm.error };

  const parsed = exchangeRateSchema.safeParse({
    fromCurrency: formData.get("fromCurrency"),
    toCurrency: formData.get("toCurrency"),
    rate: formData.get("rate"),
    effectiveDate: formData.get("effectiveDate"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(exchangeRates).values({
        tenantId: user.tenant_id,
        ...parsed.data,
      });
    });
  } catch {
    return { success: false, error: "Failed to add exchange rate." };
  }

  revalidatePath("/app/settings/currencies");
  return { success: true };
}

/** Returns the most recent exchange rate ≤ date for a currency pair. Returns 1 if same currency or no rate found. */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date: string,
  tenantId: string
): Promise<number> {
  if (fromCurrency === toCurrency) return 1;
  const { db } = await import("@/lib/db");
  const [row] = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.tenantId, tenantId),
        eq(exchangeRates.fromCurrency, fromCurrency),
        eq(exchangeRates.toCurrency, toCurrency),
        lte(exchangeRates.effectiveDate, date)
      )
    )
    .orderBy(desc(exchangeRates.effectiveDate))
    .limit(1);
  return row ? parseFloat(row.rate) : 1;
}
