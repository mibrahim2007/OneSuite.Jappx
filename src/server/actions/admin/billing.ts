"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionState = { success: true } | { success: false; error: string } | null;

const planSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/i, "Code must be alphanumeric."),
  priceMonthly: z.string().regex(/^\d+(\.\d+)?$/, "Enter a valid price."),
  maxUsers: z.string().optional().nullable(),
  modules: z.string().optional(),
});

const subscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  status: z.enum(["trialing", "active", "past_due", "canceled", "expired"]),
  seats: z.string().regex(/^\d+$/).default("1"),
  trialEndsAt: z.string().optional().nullable(),
  currentPeriodEnd: z.string().optional().nullable(),
});

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function savePlanAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("platform:billing:manage", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim() || null;
  if (id && !UUID_RE.test(id)) return { success: false, error: "Invalid plan ID." };

  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    priceMonthly: formData.get("priceMonthly"),
    maxUsers: (formData.get("maxUsers") as string) || null,
    modules: formData.get("modules"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const moduleList = parsed.data.modules
    ? parsed.data.modules.split(",").map((m) => m.trim()).filter(Boolean)
    : [];

  try {
    if (id) {
      await db.update(plans).set({
        name: parsed.data.name,
        code: parsed.data.code,
        priceMonthly: parsed.data.priceMonthly,
        maxUsers: parsed.data.maxUsers ? parseInt(parsed.data.maxUsers) : null,
        modules: moduleList,
      }).where(eq(plans.id, id));
    } else {
      await db.insert(plans).values({
        name: parsed.data.name,
        code: parsed.data.code,
        priceMonthly: parsed.data.priceMonthly,
        maxUsers: parsed.data.maxUsers ? parseInt(parsed.data.maxUsers) : null,
        modules: moduleList,
      });
    }
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return { success: false, error: "Plan code already in use." };
    }
    return { success: false, error: "Failed to save plan." };
  }

  try { await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "plans", entityId: id ?? "new", action: id ? "plan_updated" : "plan_created", changes: parsed.data }); } catch { /* non-fatal */ }
  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function togglePlanAction(planId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(planId)) return { success: false, error: "Invalid ID." };

  const permError = requirePermission("platform:billing:manage", user);
  if (permError) return { success: false, error: permError.error };

  try {
    await db.update(plans).set({ isActive }).where(eq(plans.id, planId));
  } catch {
    return { success: false, error: "Failed to update plan." };
  }

  revalidatePath("/admin/subscriptions");
  return { success: true };
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function saveSubscriptionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("platform:billing:manage", user);
  if (permError) return { success: false, error: permError.error };

  const id = (formData.get("id") as string)?.trim() || null;
  if (id && !UUID_RE.test(id)) return { success: false, error: "Invalid subscription ID." };

  const parsed = subscriptionSchema.safeParse({
    tenantId: formData.get("tenantId"),
    planId: formData.get("planId"),
    status: formData.get("status"),
    seats: (formData.get("seats") as string) || "1",
    trialEndsAt: (formData.get("trialEndsAt") as string) || null,
    currentPeriodEnd: (formData.get("currentPeriodEnd") as string) || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { tenantId, planId, status, seats, trialEndsAt, currentPeriodEnd } = parsed.data;

  try {
    if (id) {
      await db.update(subscriptions).set({
        planId, status,
        seats: parseInt(seats),
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
      }).where(eq(subscriptions.id, id));
    } else {
      await db.insert(subscriptions).values({
        tenantId, planId, status,
        seats: parseInt(seats),
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
      });
    }
  } catch {
    return { success: false, error: "Failed to save subscription." };
  }

  revalidatePath("/admin/subscriptions");
  return { success: true };
}
