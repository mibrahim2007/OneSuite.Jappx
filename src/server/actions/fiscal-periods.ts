"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { fiscalPeriods } from "@/lib/db/schema";
import { tenants } from "@/lib/db/schema/platform";
import { createAuditLog } from "@/lib/audit";
import { createFiscalYearSchema, PERIOD_STATUSES } from "@/lib/validations/fiscal-periods";

const REVALIDATE_PATH = "/app/accounts/fiscal-periods";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function createFiscalYearAction(
  startYear: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:period:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = createFiscalYearSchema.safeParse({ startYear });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid year." };
  }

  const ctx = {
    tenantId: user.tenant_id,
    userId: user.sub,
    permissions: user.permissions,
  };

  let result: { duplicate: boolean; yearLabel: string; fiscalStartMonth: number };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      // Fetch fiscalStartMonth inside the transaction to avoid TOCTOU with concurrent settings changes
      const [tenantRow] = await tx
        .select({ fiscalStartMonth: tenants.fiscalStartMonth })
        .from(tenants)
        .where(eq(tenants.id, user.tenant_id))
        .limit(1);

      if (!tenantRow) throw new Error("Tenant not found.");

      const fiscalStartMonth = tenantRow.fiscalStartMonth;
      const shortNext = String((startYear + 1) % 100).padStart(2, "0");
      const yearLabel =
        fiscalStartMonth === 1 ? `FY ${startYear}` : `FY ${startYear}-${shortNext}`;

      const [existing] = await tx
        .select({ id: fiscalPeriods.id })
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.tenantId, user.tenant_id),
            eq(fiscalPeriods.yearLabel, yearLabel)
          )
        )
        .limit(1);

      if (existing) return { duplicate: true, yearLabel, fiscalStartMonth };

      const rows: (typeof fiscalPeriods.$inferInsert)[] = [];
      for (let i = 0; i < 12; i++) {
        const totalMonth = fiscalStartMonth - 1 + i;
        const monthIndex = totalMonth % 12;
        const yearOffset = Math.floor(totalMonth / 12);
        const periodYear = startYear + yearOffset;
        const monthNum = monthIndex + 1;

        const lastDay = new Date(periodYear, monthIndex + 1, 0).getDate();
        const startDate = `${periodYear}-${String(monthNum).padStart(2, "0")}-01`;
        const endDate = `${periodYear}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        rows.push({
          tenantId: user.tenant_id,
          yearLabel,
          periodNum: i + 1,
          name: `${MONTH_NAMES[monthIndex]} ${periodYear}`,
          startDate,
          endDate,
          status: "open",
        });
      }

      await tx.insert(fiscalPeriods).values(rows);
      return { duplicate: false, yearLabel, fiscalStartMonth };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Tenant not found.") return { success: false, error: "Tenant not found." };
    const code = (err as { code?: string })?.code;
    if (code === "23505") return { success: false, error: "Fiscal year already exists." };
    return { success: false, error: "Failed to create fiscal year." };
  }

  if (result.duplicate) return { success: false, error: "Fiscal year already exists." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "fiscal_periods",
      action: "fiscal_year_created",
      changes: { yearLabel: result.yearLabel, fiscalStartMonth: result.fiscalStartMonth },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function setPeriodStatusAction(
  periodId: string,
  newStatus: "open" | "closed" | "locked"
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!(PERIOD_STATUSES as ReadonlyArray<string>).includes(newStatus as string)) {
    return { success: false, error: "Invalid status value." };
  }

  if (!UUID_RE.test(periodId)) return { success: false, error: "Invalid period ID." };

  const requiredPerm =
    newStatus === "locked" ? "accounts:period:lock" : "accounts:period:close";
  const permError = requirePermission(requiredPerm, user);
  if (permError) return { success: false, error: permError.error };

  const ctx = {
    tenantId: user.tenant_id,
    userId: user.sub,
    permissions: user.permissions,
  };

  let result: { notFound: boolean; locked: boolean; invalidTransition: boolean; periodName: string };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({
          id: fiscalPeriods.id,
          status: fiscalPeriods.status,
          name: fiscalPeriods.name,
        })
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.id, periodId),
            eq(fiscalPeriods.tenantId, user.tenant_id)
          )
        )
        .limit(1);

      if (!existing) return { notFound: true, locked: false, invalidTransition: false, periodName: "" };
      if (existing.status === "locked") return { notFound: false, locked: true, invalidTransition: false, periodName: existing.name };
      if (newStatus === "locked" && existing.status !== "closed") {
        return { notFound: false, locked: false, invalidTransition: true, periodName: existing.name };
      }

      await tx
        .update(fiscalPeriods)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(
          and(
            eq(fiscalPeriods.id, periodId),
            eq(fiscalPeriods.tenantId, user.tenant_id)
          )
        );

      return { notFound: false, locked: false, invalidTransition: false, periodName: existing.name };
    });
  } catch {
    return { success: false, error: "Failed to update period status." };
  }

  if (result.notFound) return { success: false, error: "Period not found." };
  if (result.locked) return { success: false, error: "Locked periods cannot be changed." };
  if (result.invalidTransition) return { success: false, error: "A period must be closed before it can be locked." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "fiscal_periods",
      entityId: periodId,
      action: `period_${newStatus}`,
      changes: { newStatus, periodName: result.periodName },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
