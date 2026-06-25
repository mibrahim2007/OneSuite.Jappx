import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { permissions, rolePermissions, roles } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleForm } from "@/components/admin/role-form";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roleId } = await params;

  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect(`/login?redirect=/admin/roles/${roleId}/edit`);

  let claims;
  try {
    claims = await verifyAccessToken(accessToken);
  } catch {
    redirect(`/login?redirect=/admin/roles/${roleId}/edit`);
  }

  const tenantId = claims.tenant_id;

  // Only allow editing custom roles belonging to this tenant
  const [role] = await db
    .select({
      id: roles.id,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
    })
    .from(roles)
    .where(
      and(
        eq(roles.id, roleId),
        eq(roles.tenantId, tenantId),
        eq(roles.isSystem, false)
      )
    )
    .limit(1);

  if (!role) notFound();

  const [currentPerms, allPermissions] = await Promise.all([
    db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id)),

    db
      .select({
        id: permissions.id,
        code: permissions.code,
        module: permissions.module,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(permissions)
      .orderBy(permissions.module, permissions.resource, asc(permissions.action)),
  ]);

  const currentPermissionIds = currentPerms.map((p) => p.permissionId);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit role</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Editing <span className="font-medium">{role.name}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm
            permissions={allPermissions}
            existingRole={{
              id: role.id,
              name: role.name,
              description: role.description,
              currentPermissionIds,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
