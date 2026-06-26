"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { leads } from "@/lib/db/schema";
import { leadSchema, type LeadStatus } from "@/lib/validations/crm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/leads";

type State = { success: true } | { success: false; error: string } | null;

function parseForm(formData: FormData) {
  return leadSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    company: (formData.get("company") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    source: (formData.get("source") as string) || null,
    score: (formData.get("score") as string) || null,
  });
}

export async function createLeadAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:lead:create", user);
  if (permError) return permError;

  const parsed = parseForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let id: string;
  try {
    const [row] = await withTenantRLS(ctx, async (tx) =>
      tx.insert(leads).values({ tenantId: user.tenant_id, ...parsed.data }).returning({ id: leads.id })
    );
    id = row!.id;
  } catch {
    return { success: false, error: "Failed to create lead." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leads", entityId: id, action: "created", changes: { name: parsed.data.name } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateLeadAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:lead:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid lead ID." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: leads.id }).from(leads)
        .where(and(eq(leads.id, id), eq(leads.tenantId, user.tenant_id))).limit(1);
      if (!existing) { notFound = true; return; }
      await tx.update(leads).set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(leads.id, id), eq(leads.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update lead." };
  }
  if (notFound) return { success: false, error: "Lead not found." };
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leads", entityId: id, action: "updated", changes: parsed.data });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateLeadStatusAction(
  leadId: string,
  status: LeadStatus
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(leadId)) return { success: false, error: "Invalid lead ID." };
  const permError = requirePermission("crm:lead:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.update(leads).set({ status, updatedAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update lead status." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "leads", entityId: leadId, action: "status_changed", changes: { status } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function deleteLeadAction(leadId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(leadId)) return { success: false, error: "Invalid lead ID." };
  const permError = requirePermission("crm:lead:delete", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) => {
      await tx.delete(leads).where(and(eq(leads.id, leadId), eq(leads.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to delete lead." };
  }
  revalidatePath(REVALIDATE);
  return { success: true };
}
