"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import {
  employees,
  salaryStructures,
  payrollRuns,
  payslips,
  journals,
  journalLines,
  accounts,
  numberSeries,
} from "@/lib/db/schema";
import {
  salaryStructureSchema,
  payrollRunSchema,
  postPayrollSchema,
} from "@/lib/validations/payroll";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ActionState = { success: true } | { success: false; error: string } | null;

// ── Salary Structures ──────────────────────────────────────────────────────

export async function upsertSalaryStructureAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:payroll:run", user);
  if (permError) return permError;

  const parsed = salaryStructureSchema.safeParse({
    employeeId: (formData.get("employeeId") as string)?.trim(),
    effectiveFrom: (formData.get("effectiveFrom") as string)?.trim(),
    basic: (formData.get("basic") as string)?.trim(),
    allowances: formData.get("allowances") as string | undefined,
    deductions: formData.get("deductions") as string | undefined,
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { employeeId, effectiveFrom, basic, allowances: aJson, deductions: dJson } = parsed.data;

  let allowances: Array<{ name: string; amount: number }> = [];
  let deductions: Array<{ name: string; amount: number }> = [];
  try {
    if (aJson) allowances = JSON.parse(aJson);
    if (dJson) deductions = JSON.parse(dJson);
  } catch {
    return { success: false, error: "Invalid allowances or deductions format." };
  }

  const basicNum = parseFloat(basic);
  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
  const gross = basicNum + totalAllowances;

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx
        .insert(salaryStructures)
        .values({
          tenantId: user.tenant_id,
          employeeId,
          effectiveFrom,
          basic: String(basicNum),
          allowances,
          deductions,
          gross: String(gross),
        })
        .onConflictDoUpdate({
          target: [salaryStructures.tenantId, salaryStructures.employeeId],
          set: {
            effectiveFrom,
            basic: String(basicNum),
            allowances,
            deductions,
            gross: String(gross),
          },
        });
    });
  } catch {
    return { success: false, error: "Failed to save salary structure." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "salary_structure",
      action: "upsert",
      entityId: employeeId,
    });
  } catch {}

  revalidatePath("/app/hrm/payroll/structures");
  return { success: true };
}

// ── Payroll Runs ───────────────────────────────────────────────────────────

export async function createPayrollRunAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:payroll:run", user);
  if (permError) return permError;

  const parsed = payrollRunSchema.safeParse({
    periodMonth: (formData.get("periodMonth") as string)?.trim(),
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(payrollRuns).values({
        tenantId: user.tenant_id,
        periodMonth: parsed.data.periodMonth,
        status: "draft",
        processedBy: user.sub,
      });
    });
  } catch {
    return { success: false, error: "Failed to create payroll run." };
  }

  revalidatePath("/app/hrm/payroll/runs");
  return { success: true };
}

export async function generatePayslipsAction(runId: string): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:payroll:run", user);
  if (permError) return permError;
  if (!UUID_RE.test(runId)) return { success: false, error: "Invalid run ID." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [run] = await tx
        .select()
        .from(payrollRuns)
        .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, user.tenant_id)))
        .limit(1);

      if (!run) throw new Error("Run not found.");
      if (run.status !== "draft") throw new Error("Run is not in draft status.");

      // Fetch all active employees with salary structures
      const structs = await tx
        .select({
          employeeId: salaryStructures.employeeId,
          basic: salaryStructures.basic,
          allowances: salaryStructures.allowances,
          deductions: salaryStructures.deductions,
          gross: salaryStructures.gross,
        })
        .from(salaryStructures)
        .innerJoin(employees, eq(salaryStructures.employeeId, employees.id))
        .where(
          and(
            eq(salaryStructures.tenantId, user.tenant_id),
            eq(employees.status, "active")
          )
        );

      if (structs.length === 0) throw new Error("No active employees with salary structures found.");

      // Delete existing draft payslips for this run
      await tx
        .delete(payslips)
        .where(
          and(eq(payslips.payrollRunId, runId), eq(payslips.tenantId, user.tenant_id))
        );

      let totalGross = 0;
      let totalNet = 0;

      for (const s of structs) {
        const basic = parseFloat(s.basic ?? "0");
        const grossVal = parseFloat(s.gross ?? "0");
        const allowancesArr = (s.allowances as Array<{ name: string; amount: number }>) ?? [];
        const deductionsArr = (s.deductions as Array<{ name: string; amount: number }>) ?? [];
        const totalAllowances = allowancesArr.reduce((sum, a) => sum + a.amount, 0);
        const totalDeductions = deductionsArr.reduce((sum, d) => sum + d.amount, 0);
        const net = grossVal - totalDeductions;

        await tx.insert(payslips).values({
          tenantId: user.tenant_id,
          payrollRunId: runId,
          employeeId: s.employeeId,
          basic: String(basic),
          allowances: String(totalAllowances),
          deductions: String(totalDeductions),
          tax: "0",
          gross: String(grossVal),
          net: String(net),
        });

        totalGross += grossVal;
        totalNet += net;
      }

      await tx
        .update(payrollRuns)
        .set({ status: "processing", totalGross: String(totalGross), totalNet: String(totalNet) })
        .where(eq(payrollRuns.id, runId));
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate payslips.";
    return { success: false, error: msg };
  }

  revalidatePath(`/app/hrm/payroll/runs/${runId}`);
  revalidatePath("/app/hrm/payroll/runs");
  return { success: true };
}

export async function postPayrollAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("hrm:payroll:run", user);
  if (permError) return permError;

  const parsed = postPayrollSchema.safeParse({
    runId: (formData.get("runId") as string)?.trim(),
    salaryExpenseAccountId: (formData.get("salaryExpenseAccountId") as string)?.trim(),
    payableAccountId: (formData.get("payableAccountId") as string)?.trim(),
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { runId, salaryExpenseAccountId, payableAccountId, deductionsPayableAccountId } = parsed.data;

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [run] = await tx
        .select()
        .from(payrollRuns)
        .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, user.tenant_id)))
        .limit(1);

      if (!run) throw new Error("Payroll run not found.");
      if (run.status !== "processing" && run.status !== "approved")
        throw new Error("Payroll must be in processing or approved status to post.");
      if (run.journalId != null) throw new Error("Payroll has already been posted to GL.");

      const totalGross = parseFloat(run.totalGross ?? "0");
      const totalNet = parseFloat(run.totalNet ?? "0");
      const totalDeductions = totalGross - totalNet;

      // Generate journal entry number
      const [numSeries] = await tx
        .update(numberSeries)
        .set({ nextNumber: sql`${numberSeries.nextNumber} + 1` })
        .where(
          and(
            eq(numberSeries.tenantId, user.tenant_id),
            eq(numberSeries.docType, "journal")
          )
        )
        .returning();

      let entryNo = `JV-${String(Date.now()).slice(-8)}`;
      if (numSeries) {
        const num = numSeries.nextNumber - 1;
        const padded = String(num).padStart(numSeries.padding, "0");
        entryNo = numSeries.prefix ? `${numSeries.prefix}${padded}` : padded;
      }

      const [journal] = await tx
        .insert(journals)
        .values({
          tenantId: user.tenant_id,
          entryNo,
          entryDate: run.periodMonth,
          source: "payroll",
          reference: `Payroll ${run.periodMonth}`,
          memo: `Payroll posting for period ${run.periodMonth}`,
          isPosted: true,
          createdBy: user.sub,
        })
        .returning({ id: journals.id });

      // DR Salary Expense (gross)
      await tx.insert(journalLines).values({
        tenantId: user.tenant_id,
        journalId: journal!.id,
        accountId: salaryExpenseAccountId,
        debit: String(totalGross),
        credit: "0",
        description: `Salary expense ${run.periodMonth}`,
      });

      // CR Payables (net pay)
      await tx.insert(journalLines).values({
        tenantId: user.tenant_id,
        journalId: journal!.id,
        accountId: payableAccountId,
        debit: "0",
        credit: String(totalNet),
        description: `Net salaries payable ${run.periodMonth}`,
      });

      // CR Deductions payable (if any) — separate account when provided
      if (totalDeductions > 0) {
        await tx.insert(journalLines).values({
          tenantId: user.tenant_id,
          journalId: journal!.id,
          accountId: deductionsPayableAccountId ?? payableAccountId,
          debit: "0",
          credit: String(totalDeductions),
          description: `Deductions payable ${run.periodMonth}`,
        });
      }

      await tx
        .update(payrollRuns)
        .set({ status: "posted", journalId: journal!.id })
        .where(eq(payrollRuns.id, runId));
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to post payroll.";
    return { success: false, error: msg };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "payroll_run",
      action: "post",
      entityId: runId,
    });
  } catch {}

  revalidatePath(`/app/hrm/payroll/runs/${runId}`);
  revalidatePath("/app/hrm/payroll/runs");
  return { success: true };
}
