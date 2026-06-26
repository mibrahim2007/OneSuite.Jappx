"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { pipelineStages, opportunities } from "@/lib/db/schema";
import { pipelineStageSchema, opportunitySchema } from "@/lib/validations/crm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/pipeline";

type State = { success: true } | { success: false; error: string } | null;

// --- Pipeline Stages ---

export async function createStageAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:opportunity:create", user);
  if (permError) return permError;

  const parsed = pipelineStageSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    sortOrder: (formData.get("sortOrder") as string) || "0",
    winProbability: (formData.get("winProbability") as string) || "0",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) =>
      tx.insert(pipelineStages).values({ tenantId: user.tenant_id, ...parsed.data })
    );
  } catch {
    return { success: false, error: "Failed to create stage." };
  }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateStageAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:opportunity:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid stage ID." };

  const parsed = pipelineStageSchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    sortOrder: (formData.get("sortOrder") as string) || "0",
    winProbability: (formData.get("winProbability") as string) || "0",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) =>
      tx.update(pipelineStages).set(parsed.data).where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenant_id)))
    );
  } catch {
    return { success: false, error: "Failed to update stage." };
  }
  revalidatePath(REVALIDATE);
  return { success: true };
}

// --- Opportunities ---

function parseOppForm(formData: FormData) {
  return opportunitySchema.safeParse({
    title: (formData.get("title") as string)?.trim(),
    companyId: (formData.get("companyId") as string) || null,
    contactId: (formData.get("contactId") as string) || null,
    stageId: (formData.get("stageId") as string) || null,
    amount: (formData.get("amount") as string) || null,
    expectedClose: (formData.get("expectedClose") as string) || null,
  });
}

export async function createOpportunityAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:opportunity:create", user);
  if (permError) return permError;

  const parsed = parseOppForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let id: string;
  try {
    const [row] = await withTenantRLS(ctx, async (tx) =>
      tx.insert(opportunities).values({ tenantId: user.tenant_id, ...parsed.data }).returning({ id: opportunities.id })
    );
    id = row!.id;
  } catch {
    return { success: false, error: "Failed to create opportunity." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "opportunities", entityId: id, action: "created", changes: { title: parsed.data.title } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateOpportunityAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:opportunity:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid opportunity ID." };

  const parsed = parseOppForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) =>
      tx.update(opportunities).set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(opportunities.id, id), eq(opportunities.tenantId, user.tenant_id)))
    );
  } catch {
    return { success: false, error: "Failed to update opportunity." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "opportunities", entityId: id, action: "updated", changes: parsed.data });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function closeOpportunityAction(
  opportunityId: string,
  isWon: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(opportunityId)) return { success: false, error: "Invalid opportunity ID." };
  const permError = requirePermission("crm:opportunity:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) =>
      tx.update(opportunities).set({ isWon, closedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(opportunities.id, opportunityId), eq(opportunities.tenantId, user.tenant_id)))
    );
  } catch {
    return { success: false, error: "Failed to close opportunity." };
  }
  revalidatePath(REVALIDATE);
  return { success: true };
}
