import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { roles, rolePermissions } from "@/lib/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RolesTable } from "@/components/admin/roles-table";

export default async function AdminRolesPage() {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login?redirect=/admin/roles");

  let claims;
  try {
    claims = await verifyAccessToken(accessToken);
  } catch {
    redirect("/login?redirect=/admin/roles");
  }

  const tenantId = claims.tenant_id;
  const canCreate = hasPermission("admin:role:create", claims);
  const canEdit = hasPermission("admin:role:update", claims);
  const canDelete = hasPermission("admin:role:delete", claims);

  const allRoles = await db
    .select({
      id: roles.id,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      permissionCount: sql<number>`cast(count(${rolePermissions.permissionId}) as integer)`,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(
      or(
        and(isNull(roles.tenantId), eq(roles.isSystem, true)),
        eq(roles.tenantId, tenantId)
      )
    )
    .groupBy(roles.id)
    .orderBy(desc(roles.isSystem), roles.name);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roles</h1>
        {canCreate && (
          <Link href="/admin/roles/new" className={buttonVariants()}>
            New role
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All roles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <RolesTable roles={allRoles} canEdit={canEdit} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
