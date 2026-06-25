"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { memberships, membershipRoles, roles, userSessions } from "@/lib/db/schema";
import { verifyAccessToken, signAccessToken } from "@/lib/auth/jwt";
import { hashRefreshToken } from "@/lib/auth/session";
import type { JWTPayload } from "@/types";

async function getAuthenticatedUser(): Promise<JWTPayload | null> {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;
  if (!accessToken) return null;
  try {
    return await verifyAccessToken(accessToken);
  } catch {
    return null;
  }
}

export async function switchTenantAction(
  targetTenantId: string
): Promise<{ success: false; error: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  if (user.tenant_id === targetTenantId) {
    redirect("/app/dashboard");
  }

  const [membership] = await db
    .select({ id: memberships.id, tenantId: memberships.tenantId })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.sub),
        eq(memberships.tenantId, targetTenantId),
        eq(memberships.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return { success: false, error: "No active membership in this organization." };
  }

  const memberRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .innerJoin(membershipRoles, eq(membershipRoles.roleId, roles.id))
    .where(eq(membershipRoles.membershipId, membership.id));

  const store = await cookies();
  const rawRefreshToken = store.get("refresh_token")?.value;

  if (rawRefreshToken) {
    const refreshHash = hashRefreshToken(rawRefreshToken);
    await db
      .update(userSessions)
      .set({ tenantId: targetTenantId })
      .where(
        and(
          eq(userSessions.refreshTokenHash, refreshHash),
          isNull(userSessions.revokedAt)
        )
      );
  }

  const newAccessToken = await signAccessToken({
    sub: user.sub,
    email: user.email,
    tenant_id: targetTenantId,
    permissions: [],
    role_ids: memberRoles.map((r) => r.id),
  });

  const isProd = process.env.NODE_ENV === "production";
  store.set("access_token", newAccessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });

  redirect("/app/dashboard");
}
