"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { crmContacts } from "@/lib/db/schema";
import { crmContactSchema } from "@/lib/validations/crm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/contacts";

type State = { success: true } | { success: false; error: string } | null;

function parseForm(formData: FormData) {
  return crmContactSchema.safeParse({
    companyId: (formData.get("companyId") as string) || null,
    fullName: (formData.get("fullName") as string)?.trim(),
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    designation: (formData.get("designation") as string) || null,
  });
}

export async function createCrmContactAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:contact:create", user);
  if (permError) return permError;

  const parsed = parseForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let id: string;
  try {
    const [row] = await withTenantRLS(ctx, async (tx) =>
      tx.insert(crmContacts).values({ tenantId: user.tenant_id, ...parsed.data }).returning({ id: crmContacts.id })
    );
    id = row!.id;
  } catch {
    return { success: false, error: "Failed to create contact." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "crm_contacts", entityId: id, action: "created", changes: { fullName: parsed.data.fullName } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateCrmContactAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:contact:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid contact ID." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: crmContacts.id }).from(crmContacts)
        .where(and(eq(crmContacts.id, id), eq(crmContacts.tenantId, user.tenant_id))).limit(1);
      if (!existing) { notFound = true; return; }
      await tx.update(crmContacts).set(parsed.data).where(and(eq(crmContacts.id, id), eq(crmContacts.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update contact." };
  }
  if (notFound) return { success: false, error: "Contact not found." };
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "crm_contacts", entityId: id, action: "updated", changes: parsed.data });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}
