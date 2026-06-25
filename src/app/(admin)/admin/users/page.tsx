import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { invitations, roles } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { PendingInvitations } from "@/components/admin/pending-invitations";

export default async function AdminUsersPage() {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login?redirect=/admin/users");

  let claims;
  try {
    claims = await verifyAccessToken(accessToken);
  } catch {
    redirect("/login?redirect=/admin/users");
  }

  const tenantId = claims.tenant_id;

  const [availableRoles, pendingInvites] = await Promise.all([
    db
      .select({ id: roles.id, name: roles.name, isSystem: roles.isSystem })
      .from(roles)
      .where(
        or(
          and(isNull(roles.tenantId), eq(roles.isSystem, true)),
          eq(roles.tenantId, tenantId)
        )
      )
      .orderBy(roles.isSystem, roles.name),

    db
      .select({
        id: invitations.id,
        email: invitations.email,
        roleName: roles.name,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .leftJoin(roles, eq(roles.id, invitations.roleId))
      .where(
        and(
          eq(invitations.tenantId, tenantId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, sql`now()`)
        )
      )
      .orderBy(invitations.createdAt),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Users</h1>

      <Card>
        <CardHeader>
          <CardTitle>Invite a user</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteUserForm roles={availableRoles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <PendingInvitations invitations={pendingInvites} />
        </CardContent>
      </Card>
    </div>
  );
}
