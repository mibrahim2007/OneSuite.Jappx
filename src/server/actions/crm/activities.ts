"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { activities } from "@/lib/db/schema";
import { activitySchema } from "@/lib/validations/crm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/activities";

type State = { success: true } | { success: false; error: string } | null;

function parseForm(formData: FormData) {
  return activitySchema.safeParse({
    type: formData.get("type") as string,
    subject: (formData.get("subject") as string)?.trim(),
    notes: (formData.get("notes") as string) || null,
    relatedEntity: (formData.get("relatedEntity") as string) || null,
    relatedId: (formData.get("relatedId") as string) || null,
    dueAt: (formData.get("dueAt") as string) || null,
  });
}

export async function createActivityAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:activity:create", user);
  if (permError) return permError;

  const parsed = parseForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { type, subject, notes, relatedEntity, relatedId, dueAt } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let id: string;
  try {
    const [row] = await withTenantRLS(ctx, async (tx) =>
      tx.insert(activities).values({
        tenantId: user.tenant_id,
        type: type as "call" | "meeting" | "email" | "task" | "note",
        subject,
        notes: notes ?? null,
        relatedEntity: relatedEntity ?? null,
        relatedId: relatedId ?? null,
        dueAt: dueAt ? new Date(dueAt) : null,
        ownerId: user.sub,
      }).returning({ id: activities.id })
    );
    id = row!.id;
  } catch {
    return { success: false, error: "Failed to create activity." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "activities", entityId: id, action: "created", changes: { type, subject } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function completeActivityAction(activityId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (!UUID_RE.test(activityId)) return { success: false, error: "Invalid activity ID." };
  const permError = requirePermission("crm:activity:create", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  try {
    await withTenantRLS(ctx, async (tx) =>
      tx.update(activities).set({ completedAt: new Date() })
        .where(and(eq(activities.id, activityId), eq(activities.tenantId, user.tenant_id)))
    );
  } catch {
    return { success: false, error: "Failed to complete activity." };
  }
  revalidatePath(REVALIDATE);
  return { success: true };
}
