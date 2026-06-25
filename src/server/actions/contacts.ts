"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { contacts } from "@/lib/db/schema";
import { contactSchema, type ContactValues } from "@/lib/validations/contacts";
import { createAuditLog } from "@/lib/audit";

const REVALIDATE_PATH = "/app/accounts/contacts";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createContactAction(
  data: ContactValues
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:contact:manage", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { type, name, code, email, phone, address, paymentTermsDays } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { id: string };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [inserted] = await tx
        .insert(contacts)
        .values({
          tenantId: user.tenant_id,
          type,
          name,
          code: code?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          paymentTermsDays: paymentTermsDays ?? null,
          isActive: true,
        })
        .returning({ id: contacts.id });
      return { id: inserted!.id };
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") return { success: false, error: "Contact code already in use." };
    return { success: false, error: "Failed to create contact." };
  }

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "contacts",
      entityId: result.id,
      action: "contact_created",
      changes: { type, name },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function updateContactAction(
  id: string,
  data: ContactValues
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(id)) return { success: false, error: "Invalid contact ID." };

  const permError = requirePermission("accounts:contact:manage", user);
  if (permError) return { success: false, error: permError.error };

  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { type, name, code, email, phone, address, paymentTermsDays } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return { notFound: true };

      await tx
        .update(contacts)
        .set({
          type,
          name,
          code: code?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          paymentTermsDays: paymentTermsDays ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenant_id)));

      return { notFound: false };
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") return { success: false, error: "Contact code already in use." };
    return { success: false, error: "Failed to update contact." };
  }

  if (result.notFound) return { success: false, error: "Contact not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "contacts",
      entityId: id,
      action: "contact_updated",
      changes: { type, name },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function toggleContactActiveAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (!UUID_RE.test(id)) return { success: false, error: "Invalid contact ID." };

  const permError = requirePermission("accounts:contact:manage", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  let result: { notFound: boolean };
  try {
    result = await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenant_id)))
        .limit(1);
      if (!existing) return { notFound: true };

      await tx
        .update(contacts)
        .set({ isActive, updatedAt: new Date() })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenant_id)));

      return { notFound: false };
    });
  } catch {
    return { success: false, error: "Failed to update contact." };
  }

  if (result.notFound) return { success: false, error: "Contact not found." };

  try {
    await createAuditLog({
      tenantId: user.tenant_id,
      userId: user.sub,
      entity: "contacts",
      entityId: id,
      action: isActive ? "contact_activated" : "contact_deactivated",
      changes: { isActive },
    });
  } catch {
    // non-fatal
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
