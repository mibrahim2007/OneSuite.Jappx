"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { tenants, journals, journalLines, numberSeries, fuelLogs, workOrders } from "@/lib/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = Parameters<Parameters<typeof withTenantRLS>[1]>[0];

async function nextJournalNo(tx: Tx, tenantId: string): Promise<string> {
  const [updated] = await tx
    .update(numberSeries)
    .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
    .where(and(eq(numberSeries.tenantId, tenantId), eq(numberSeries.docType, "journal")))
    .returning();
  if (!updated) return `JV-${String(Date.now()).slice(-8)}`;
  const num = updated.nextNumber - 1;
  return updated.prefix ? `${updated.prefix}${String(num).padStart(updated.padding, "0")}` : String(num).padStart(updated.padding, "0");
}

async function getGlMappings(tx: Tx, tenantId: string) {
  const [tenant] = await tx
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  const s = tenant?.settings as Record<string, unknown> | null;
  return (s?.gl_mappings ?? {}) as Record<string, string>;
}

export async function postFuelCostsAction(
  _prevState: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:journal:create", user);
  if (permError) return { success: false, error: permError.error };

  const fromDate = formData.get("from_date") as string;
  const toDate = formData.get("to_date") as string;
  if (!fromDate || !toDate) return { success: false, error: "Date range required." };

  let journalId: string | undefined;
  try {
    const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
    const result = await withTenantRLS(ctx, async (tx) => {
      const mappings = await getGlMappings(tx, user.tenant_id);
      const fuelExpAccId = mappings["fleet_fuel_expense"];
      const payableAccId = mappings["fleet_payable"];
      if (!fuelExpAccId || !payableAccId) {
        return { ok: false as const, error: "GL mappings not configured. Set Fleet Fuel Expense and Fleet Payable accounts in Settings → GL Mappings." };
      }

      // Sum fuel costs for the period
      const [totals] = await tx
        .select({ total: sql<string>`SUM(${fuelLogs.cost})` })
        .from(fuelLogs)
        .where(and(
          eq(fuelLogs.tenantId, user.tenant_id),
          gte(fuelLogs.fuelDate, fromDate),
          lte(fuelLogs.fuelDate, toDate)
        ));

      const total = parseFloat(totals?.total ?? "0");
      if (total <= 0) return { ok: false as const, error: "No fuel costs found in the selected date range." };

      const entryNo = await nextJournalNo(tx, user.tenant_id);
      const [journal] = await tx
        .insert(journals)
        .values({
          tenantId: user.tenant_id,
          entryNo,
          entryDate: toDate,
          source: "fleet",
          reference: `Fuel costs ${fromDate} to ${toDate}`,
          memo: `Fleet fuel cost roll-up: ${fromDate} – ${toDate}`,
          isPosted: true,
          createdBy: user.sub,
        })
        .returning({ id: journals.id });

      await tx.insert(journalLines).values([
        {
          tenantId: user.tenant_id,
          journalId: journal!.id,
          accountId: fuelExpAccId,
          debit: String(total),
          credit: "0",
          description: `Fleet fuel expense ${fromDate}–${toDate}`,
        },
        {
          tenantId: user.tenant_id,
          journalId: journal!.id,
          accountId: payableAccId,
          debit: "0",
          credit: String(total),
          description: `Fleet fuel payable ${fromDate}–${toDate}`,
        },
      ]);

      return { ok: true as const, journalId: journal!.id };
    });

    if (!result.ok) return { success: false, error: result.error };
    journalId = result.journalId;
  } catch {
    return { success: false, error: "Failed to post fuel costs to GL." };
  }

  try {
    await createAuditLog({ entity: "fleet_gl_posting", entityId: journalId ?? "", action: "create", userId: user.sub, tenantId: user.tenant_id, changes: { fromDate, toDate } });
  } catch {}

  revalidatePath("/app/fleet/gl-posting");
  return { success: true };
}

export async function postWorkOrderCostAction(woId: string): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(woId)) return { success: false, error: "Invalid work order ID." };

  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:journal:create", user);
  if (permError) return { success: false, error: permError.error };

  try {
    const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
    const result = await withTenantRLS(ctx, async (tx) => {
      const [wo] = await tx
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.id, woId), eq(workOrders.tenantId, user.tenant_id)))
        .limit(1);

      if (!wo) return { ok: false as const, error: "Work order not found." };
      if (wo.journalId) return { ok: false as const, error: "Work order already posted to GL." };
      if (wo.status !== "completed" && wo.status !== "closed") {
        return { ok: false as const, error: "Work order must be completed before posting." };
      }

      const total = parseFloat(wo.totalCost ?? "0");
      if (total <= 0) return { ok: false as const, error: "Work order has no costs to post." };

      const mappings = await getGlMappings(tx, user.tenant_id);
      const expAccId = mappings["wo_maintenance_expense"];
      const payAccId = mappings["wo_payable"];
      if (!expAccId || !payAccId) {
        return { ok: false as const, error: "GL mappings not configured. Set WO Maintenance Expense and WO Payable accounts in Settings → GL Mappings." };
      }

      const entryNo = await nextJournalNo(tx, user.tenant_id);
      const [journal] = await tx
        .insert(journals)
        .values({
          tenantId: user.tenant_id,
          entryNo,
          entryDate: (wo.completedAt ?? new Date()).toISOString().slice(0, 10),
          source: "rm",
          reference: wo.woNo,
          memo: `Work order cost: ${wo.title}`,
          isPosted: true,
          createdBy: user.sub,
        })
        .returning({ id: journals.id });

      await tx.insert(journalLines).values([
        { tenantId: user.tenant_id, journalId: journal!.id, accountId: expAccId, debit: String(total), credit: "0", description: `WO ${wo.woNo} maintenance expense` },
        { tenantId: user.tenant_id, journalId: journal!.id, accountId: payAccId, debit: "0", credit: String(total), description: `WO ${wo.woNo} payable` },
      ]);

      await tx.update(workOrders).set({ journalId: journal!.id }).where(eq(workOrders.id, woId));
      return { ok: true as const };
    });

    if (!result.ok) return { success: false, error: result.error };
  } catch {
    return { success: false, error: "Failed to post work order cost to GL." };
  }

  try {
    await createAuditLog({ entity: "work_order", entityId: woId, action: "gl_post", userId: user.sub, tenantId: user.tenant_id });
  } catch {}

  revalidatePath("/app/fleet/gl-posting");
  revalidatePath("/app/rm/work-orders");
  return { success: true };
}
