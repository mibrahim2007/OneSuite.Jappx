import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import {
  users,
  tenants,
  memberships,
  membershipRoles,
  roles,
  notifications,
} from "@/lib/db/schema";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import type { OrgMembership } from "@/components/app/org-switcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) redirect("/login");

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    redirect("/login");
  }

  // Parallel queries for user profile + tenant/membership data + unread count
  const [userProfileRows, membershipRows, unreadCountRows] = await Promise.all([
    db
      .select({
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1),

    db
      .select({
        tenantId: memberships.tenantId,
        tenantName: tenants.name,
        tenantLogoUrl: tenants.logoUrl,
        tenantAccentColor: tenants.accentColor,
        roleName: roles.name,
      })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
      .leftJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(
        and(eq(memberships.userId, user.sub), eq(memberships.status, "active"))
      ),

    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, user.tenant_id),
          eq(notifications.userId, user.sub),
          isNull(notifications.readAt)
        )
      ),
  ]);

  const userProfile = userProfileRows[0];
  if (!userProfile) redirect("/login");

  const unreadCount = unreadCountRows[0]?.count ?? 0;

  // Deduplicate: one row per tenant
  const seen = new Set<string>();
  const userMemberships: OrgMembership[] = membershipRows.filter((r) => {
    if (seen.has(r.tenantId)) return false;
    seen.add(r.tenantId);
    return true;
  });

  const currentTenant = membershipRows.find(
    (r) => r.tenantId === user.tenant_id
  );
  const accentColor = currentTenant?.tenantAccentColor ?? null;

  return (
    <PermissionsProvider permissions={user.permissions}>
      <div
        className="flex min-h-screen"
        style={
          accentColor
            ? ({ "--accent": accentColor } as React.CSSProperties)
            : undefined
        }
      >
        <AdminSidebar permissions={user.permissions} />
        <div className="flex flex-1 flex-col min-w-0">
          <AdminHeader
            tenantName={currentTenant?.tenantName ?? "Admin"}
            tenantLogoUrl={currentTenant?.tenantLogoUrl ?? null}
            userFullName={userProfile.fullName}
            userEmail={userProfile.email}
            userAvatarUrl={userProfile.avatarUrl}
            memberships={userMemberships}
            currentTenantId={user.tenant_id}
            unreadCount={unreadCount}
            userId={user.sub}
          />
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
