"use server";

import { revalidatePath } from "next/cache";
import { and, eq, lte, sql } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { workOrders, woTasks, woParts, pmSchedules, stockLevels, stockMoves } from "@/lib/db/schema";
import { workOrderSchema, woTaskSchema, woPartSchema } from "@/lib/validations/maintenance";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/maintenance/work-orders";

type ActionState = { success: true } | { success: false; error: string } | null;

function genWoNo(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `WO-${d}-${r}`;
}

export async function createWorkOrderAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:workorder:create", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = workOrderSchema.safeParse({
    assetId: (formData.get("assetId") as string) || null,
    type: (formData.get("type") as string) || "corrective",
    priority: (formData.get("priority") as string) || "medium",
    title: (formData.get("title") as string)?.trim(),
    description: (formData.get("description") as string)?.trim() || null,
    assignedTo: (formData.get("assignedTo") as string) || null,
    scheduledDate: (formData.get("scheduledDate") as string) || null,
    laborHours: null,
    laborCost: null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { assetId, type, priority, title, description, assignedTo, scheduledDate } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  const woNo = genWoNo();
  const status = assignedTo ? "assigned" : "open";

  let woId: string;
  try {
    const result = await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx.insert(workOrders).values({
        tenantId: user.tenant_id,
        woNo,
        assetId: assetId ?? null,
        type: type as "corrective" | "preventive" | "inspection",
        priority: priority as "low" | "medium" | "high" | "critical",
        status: status as "open" | "assigned",
        title,
        description: description ?? null,
        reportedBy: user.sub,
        assignedTo: assignedTo ?? null,
        scheduledDate: scheduledDate ?? null,
      }).returning({ id: workOrders.id });
      return inserted!.id;
    });
    woId = result;
  } catch {
    return { success: false, error: "Failed to create work order." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "work_orders", entityId: woId, action: "wo_created", changes: { woNo, title, type } });
  } catch { /* non-fatal */ }

  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateWorkOrderAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:workorder:update", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid work order ID." };

  const parsed = workOrderSchema.safeParse({
    assetId: (formData.get("assetId") as string) || null,
    type: formData.get("type") || "corrective",
    priority: formData.get("priority") || "medium",
    title: (formData.get("title") as string)?.trim(),
    description: (formData.get("description") as string)?.trim() || null,
    assignedTo: (formData.get("assignedTo") as string) || null,
    scheduledDate: (formData.get("scheduledDate") as string) || null,
    laborHours: (formData.get("laborHours") as string) || null,
    laborCost: (formData.get("laborCost") as string) || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { assetId, type, priority, title, description, assignedTo, scheduledDate, laborHours, laborCost } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: workOrders.id }).from(workOrders)
        .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, user.tenant_id))).limit(1);
      if (!existing) { notFound = true; return; }

      const lh = parseFloat(laborHours ?? "0");
      const lc = parseFloat(laborCost ?? "0");

      await tx.update(workOrders).set({
        assetId: assetId ?? null,
        type: type as "corrective" | "preventive" | "inspection",
        priority: priority as "low" | "medium" | "high" | "critical",
        title,
        description: description ?? null,
        assignedTo: assignedTo ?? null,
        scheduledDate: scheduledDate ?? null,
        laborHours: String(lh),
        laborCost: String(lc),
        updatedAt: new Date(),
      }).where(and(eq(workOrders.id, id), eq(workOrders.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update work order." };
  }

  if (notFound) return { success: false, error: "Work order not found." };

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "work_orders", entityId: id, action: "wo_updated", changes: { title } });
  } catch { /* non-fatal */ }

  revalidatePath(REVALIDATE);
  revalidatePath(`/app/maintenance/work-orders/${id}`);
  return { success: true };
}

export async function updateWorkOrderStatusAction(
  woId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(woId)) return { success: false, error: "Invalid work order ID." };

  const isClos = status === "closed" || status === "completed";
  const perm = isClos ? "rm:workorder:close" : "rm:workorder:update";
  const permError = requirePermission(perm, user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const isDone = status === "completed" || status === "closed";
  try {
    await withTenantRLS(ctx, async (tx) => {
      if (isDone) {
        await tx.update(workOrders).set({
          status: status as "completed" | "closed",
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(eq(workOrders.id, woId), eq(workOrders.tenantId, user.tenant_id)));
      } else {
        await tx.update(workOrders).set({
          status: status as "open" | "assigned" | "in_progress" | "on_hold" | "cancelled",
          updatedAt: new Date(),
        }).where(and(eq(workOrders.id, woId), eq(workOrders.tenantId, user.tenant_id)));
      }
    });
  } catch {
    return { success: false, error: "Failed to update status." };
  }

  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "work_orders", entityId: woId, action: "wo_status_changed", changes: { status } });
  } catch { /* non-fatal */ }

  revalidatePath(REVALIDATE);
  revalidatePath(`/app/maintenance/work-orders/${woId}`);
  return { success: true };
}

export async function addWoTaskAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:workorder:update", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = woTaskSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    description: (formData.get("description") as string)?.trim(),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { workOrderId, description } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.insert(woTasks).values({ tenantId: user.tenant_id, workOrderId, description });
    });
  } catch {
    return { success: false, error: "Failed to add task." };
  }

  revalidatePath(`/app/maintenance/work-orders/${workOrderId}`);
  return { success: true };
}

export async function toggleWoTaskAction(
  taskId: string,
  isDone: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(taskId)) return { success: false, error: "Invalid task ID." };

  const permError = requirePermission("rm:workorder:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(woTasks).set({ isDone })
        .where(and(eq(woTasks.id, taskId), eq(woTasks.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update task." };
  }

  return { success: true };
}

export async function addWoPartAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:parts:consume", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = woPartSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    itemId: formData.get("itemId"),
    warehouseId: (formData.get("warehouseId") as string) || null,
    quantity: formData.get("quantity"),
    unitCost: (formData.get("unitCost") as string) || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { workOrderId, itemId, warehouseId, quantity, unitCost } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  const qty = parseFloat(quantity);
  const cost = parseFloat(unitCost ?? "0");

  try {
    await withTenantRLS(ctx, async (tx) => {
      // Check stock if warehouse specified
      if (warehouseId) {
        const [level] = await tx.select({ quantity: stockLevels.quantity })
          .from(stockLevels)
          .where(and(
            eq(stockLevels.itemId, itemId),
            eq(stockLevels.warehouseId, warehouseId),
            eq(stockLevels.tenantId, user.tenant_id),
          )).limit(1);
        const available = parseFloat(level?.quantity ?? "0");
        if (available < qty) {
          throw Object.assign(new Error(`Insufficient stock. Available: ${available}.`), { isUserError: true });
        }
        // Issue stock
        const newQty = available - qty;
        await tx.insert(stockLevels)
          .values({ tenantId: user.tenant_id, itemId, warehouseId, quantity: String(newQty), avgCost: "0" })
          .onConflictDoUpdate({
            target: [stockLevels.tenantId, stockLevels.itemId, stockLevels.warehouseId],
            set: { quantity: String(newQty) },
          });
        await tx.insert(stockMoves).values({
          tenantId: user.tenant_id,
          moveType: "issue",
          itemId,
          warehouseId,
          quantity: String(qty),
          unitCost: String(cost),
          reference: `WO-PARTS:${workOrderId}`,
          moveDate: new Date().toISOString().slice(0, 10),
          createdBy: user.sub,
        });
      }
      // Insert wo_part
      await tx.insert(woParts).values({
        tenantId: user.tenant_id,
        workOrderId,
        itemId,
        warehouseId: warehouseId ?? null,
        quantity: String(qty),
        unitCost: String(cost),
      });
      // Update parts_cost on work order
      await tx.execute(
        sql`UPDATE work_orders SET parts_cost = COALESCE(parts_cost,0) + ${qty * cost}, total_cost = COALESCE(labor_cost,0) + COALESCE(parts_cost,0) + ${qty * cost}, updated_at = now() WHERE id = ${workOrderId} AND tenant_id = ${user.tenant_id}`
      );
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to add part.";
    return { success: false, error: msg };
  }

  revalidatePath(`/app/maintenance/work-orders/${workOrderId}`);
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function generateDuePmWorkOrdersAction(): Promise<{ success: boolean; count?: number; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("rm:workorder:create", user);
  if (permError) return { success: false, error: permError.error };

  const today = new Date().toISOString().slice(0, 10);
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let count = 0;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const dueSchedules = await tx.select().from(pmSchedules)
        .where(and(
          eq(pmSchedules.tenantId, user.tenant_id),
          eq(pmSchedules.isActive, true),
          lte(pmSchedules.nextDueDate, today),
        ));

      for (const sched of dueSchedules) {
        const woNo = genWoNo();
        await tx.insert(workOrders).values({
          tenantId: user.tenant_id,
          woNo,
          assetId: sched.assetId,
          type: "preventive",
          priority: "medium",
          status: "open",
          title: `PM: ${sched.name}`,
          description: `Generated from PM schedule: ${sched.name}`,
          reportedBy: user.sub,
          scheduledDate: sched.nextDueDate,
        });
        count++;
      }
    });
  } catch {
    return { success: false, error: "Failed to generate work orders." };
  }

  revalidatePath(REVALIDATE);
  return { success: true, count };
}
