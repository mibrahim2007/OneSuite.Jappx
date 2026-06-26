"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createAuditLog } from "@/lib/audit";
import { crmCompanies } from "@/lib/db/schema";
import { crmCompanySchema } from "@/lib/validations/crm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVALIDATE = "/app/crm/companies";

type State = { success: true } | { success: false; error: string } | null;

function parseForm(formData: FormData) {
  return crmCompanySchema.safeParse({
    name: (formData.get("name") as string)?.trim(),
    industry: (formData.get("industry") as string) || null,
    website: (formData.get("website") as string) || null,
  });
}

export async function createCompanyAction(_prev: State, formData: FormData): Promise<State> {
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
      tx.insert(crmCompanies).values({ tenantId: user.tenant_id, ...parsed.data }).returning({ id: crmCompanies.id })
    );
    id = row!.id;
  } catch {
    return { success: false, error: "Failed to create company." };
  }
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "crm_companies", entityId: id, action: "created", changes: { name: parsed.data.name } });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}

export async function updateCompanyAction(_prev: State, formData: FormData): Promise<State> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("crm:contact:update", user);
  if (permError) return permError;

  const id = (formData.get("id") as string)?.trim();
  if (!id || !UUID_RE.test(id)) return { success: false, error: "Invalid company ID." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const ctx = { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions };
  let notFound = false;
  try {
    await withTenantRLS(ctx, async (tx) => {
      const [existing] = await tx.select({ id: crmCompanies.id }).from(crmCompanies)
        .where(and(eq(crmCompanies.id, id), eq(crmCompanies.tenantId, user.tenant_id))).limit(1);
      if (!existing) { notFound = true; return; }
      await tx.update(crmCompanies).set(parsed.data).where(and(eq(crmCompanies.id, id), eq(crmCompanies.tenantId, user.tenant_id)));
    });
  } catch {
    return { success: false, error: "Failed to update company." };
  }
  if (notFound) return { success: false, error: "Company not found." };
  try {
    await createAuditLog({ tenantId: user.tenant_id, userId: user.sub, entity: "crm_companies", entityId: id, action: "updated", changes: parsed.data });
  } catch { /* non-fatal */ }
  revalidatePath(REVALIDATE);
  return { success: true };
}
