import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { tenants, accounts } from "@/lib/db/schema";
import { GlMappingsForm } from "@/components/app/settings/gl-mappings-form";

export default async function GlMappingsPage() {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    redirect("/api/auth/refresh?next=/app/settings/gl-mappings");
  }

  const permError = requirePermission("admin:settings:view", user);
  if (permError) redirect("/app/dashboard");

  const canEdit = user.permissions.includes("admin:settings:update");

  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, user.tenant_id));

  const s = tenant?.settings as Record<string, unknown> | null;
  const mappings = (s?.gl_mappings ?? {}) as Record<string, string>;

  const expenseAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.tenantId, user.tenant_id))
    .orderBy(accounts.code);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">GL Account Mappings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Map operational cost types to GL accounts for automatic journal posting.
      </p>
      <GlMappingsForm mappings={mappings} accounts={expenseAccounts} canEdit={canEdit} />
    </div>
  );
}
