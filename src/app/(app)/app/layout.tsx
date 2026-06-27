import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, or, isNull, sql } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import {
  users,
  memberships,
  membershipRoles,
  roles,
  tenants,
  subscriptions,
  notifications,
} from "@/lib/db/schema";
import type { OrgMembership } from "@/components/app/org-switcher";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppHeader } from "@/components/app/app-header";
import { AppBreadcrumb } from "@/components/app/app-breadcrumb";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  let user;
  try {
    user = await verifyAccessToken(accessToken);
  } catch {
    redirect("/api/auth/refresh?next=/app/dashboard");
  }

  // Parallel queries: memberships, subscription, user profile, unread notification count
  const [rows, subscriptionRows, userProfileRows, unreadCountRows] = await Promise.all([
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
      .select({ enabledModules: subscriptions.enabledModules })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, user.tenant_id),
          or(
            eq(subscriptions.status, "active"),
            eq(subscriptions.status, "trialing")
          )
        )
      )
      .limit(1),

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

  const enabledModules = subscriptionRows[0]?.enabledModules ?? [];
  const unreadCount = unreadCountRows[0]?.count ?? 0;

  // Deduplicate: one row per tenant
  const seen = new Set<string>();
  const userMemberships: OrgMembership[] = rows.filter((r) => {
    if (seen.has(r.tenantId)) return false;
    seen.add(r.tenantId);
    return true;
  });

  const currentTenant = rows.find((r) => r.tenantId === user.tenant_id);
  const currentTenantAccent = currentTenant?.tenantAccentColor ?? null;

  return (
    <PermissionsProvider permissions={user.permissions}>
      <div
        className="flex min-h-screen"
        style={
          currentTenantAccent
            ? ({ "--accent": currentTenantAccent } as React.CSSProperties)
            : undefined
        }
      >
        <AppSidebar
          permissions={user.permissions}
          enabledModules={enabledModules}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader
            tenantName={currentTenant?.tenantName ?? ""}
            tenantLogoUrl={currentTenant?.tenantLogoUrl ?? null}
            userFullName={userProfile.fullName}
            userEmail={userProfile.email}
            userAvatarUrl={userProfile.avatarUrl}
            memberships={userMemberships}
            currentTenantId={user.tenant_id}
            permissions={user.permissions}
            enabledModules={enabledModules}
            unreadCount={unreadCount}
            userId={user.sub}
          />
          <main className="flex-1 overflow-auto bg-background">
            <AppBreadcrumb />
            {children}
          </main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
