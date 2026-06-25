import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { permissions } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleForm } from "@/components/admin/role-form";

export default async function NewRolePage() {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login?redirect=/admin/roles/new");

  try {
    await verifyAccessToken(accessToken);
  } catch {
    redirect("/login?redirect=/admin/roles/new");
  }

  const allPermissions = await db
    .select({
      id: permissions.id,
      code: permissions.code,
      module: permissions.module,
      resource: permissions.resource,
      action: permissions.action,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(permissions.module, permissions.resource, asc(permissions.action));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New role</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a custom role and assign the permissions it should have.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm permissions={allPermissions} />
        </CardContent>
      </Card>
    </div>
  );
}
