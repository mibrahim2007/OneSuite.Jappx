"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requirePermission } from "@/lib/auth/permissions";
import { getActionUser } from "@/lib/auth/get-action-user";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { accounts } from "@/lib/db/schema";
import { accountFormSchema, updateAccountSchema } from "@/lib/validations/accounts";
import { createAuditLog } from "@/lib/audit";

type AccountActionState =
  | { success: true }
  | { success: false; error: string }
  | null;

export async function createAccountAction(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:coa:create", user);
  if (permError) return permError;

  const parsed = accountFormSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
    groupId: (formData.get("groupId") as string) || undefined,
    currency: (formData.get("currency") as string) || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { code, name, type, groupId, currency } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const result = await withTenantRLS(ctx, async (tx) => {
    try {
      const [inserted] = await tx
        .insert(accounts)
        .values({
          tenantId: user.tenant_id,
          code,
          name,
          type,
          groupId: groupId?.trim() || null,
          currency: currency?.trim() || null,
          isSystem: false,
          isActive: true,
        })
        .returning({ id: accounts.id });

      return { duplicate: false, id: inserted!.id };
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        return { duplicate: true, id: null as string | null };
      }
      throw err;
    }
  });

  if (result.duplicate) return { success: false, error: "Account code already exists." };

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "accounts",
    entityId: result.id,
    action: "account_created",
    changes: { code, name, type },
  });

  revalidatePath("/app/accounts/chart-of-accounts");
  return { success: true };
}

export async function updateAccountAction(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:coa:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { success: false, error: "Account ID is required." };

  const parsed = updateAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    groupId: (formData.get("groupId") as string) || undefined,
    currency: (formData.get("currency") as string) || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, type, groupId, currency } = parsed.data;
  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const result = await withTenantRLS(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: accounts.id, isSystem: accounts.isSystem })
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.tenantId, user.tenant_id)))
      .limit(1);
    if (!existing) return { notFound: true, system: false };
    if (existing.isSystem) return { notFound: false, system: true };

    await tx
      .update(accounts)
      .set({
        name,
        type,
        groupId: groupId?.trim() || null,
        currency: currency?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, id), eq(accounts.tenantId, user.tenant_id)));

    return { notFound: false, system: false };
  });

  if (result.notFound) return { success: false, error: "Account not found." };
  if (result.system) return { success: false, error: "System accounts cannot be edited." };

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "accounts",
    entityId: id,
    action: "account_updated",
    changes: { name, type },
  });

  revalidatePath("/app/accounts/chart-of-accounts");
  return { success: true };
}

export async function toggleAccountActiveAction(
  accountId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const permError = requirePermission("accounts:coa:update", user);
  if (permError) return { success: false, error: permError.error };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };

  const result = await withTenantRLS(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: accounts.id, isSystem: accounts.isSystem })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.tenantId, user.tenant_id)))
      .limit(1);
    if (!existing) return { notFound: true, system: false };
    if (existing.isSystem) return { notFound: false, system: true };

    await tx
      .update(accounts)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(accounts.id, accountId), eq(accounts.tenantId, user.tenant_id)));

    return { notFound: false, system: false };
  });

  if (result.notFound) return { success: false, error: "Account not found." };
  if (result.system) return { success: false, error: "System accounts cannot be modified." };

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "accounts",
    entityId: accountId,
    action: isActive ? "account_activated" : "account_deactivated",
    changes: { isActive },
  });

  revalidatePath("/app/accounts/chart-of-accounts");
  return { success: true };
}
