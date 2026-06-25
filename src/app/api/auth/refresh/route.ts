import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  userSessions,
  users,
  memberships,
  roles,
  membershipRoles,
} from "@/lib/db/schema";
import { hashRefreshToken } from "@/lib/auth/session";
import { signAccessToken } from "@/lib/auth/jwt";
import { loadPermissionsForRoles } from "@/lib/auth/permissions";

function deleteAndRedirectToLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}

export async function GET(request: NextRequest) {
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/app/dashboard";
  // Allow internal /app/* and /admin/* destinations only — block open redirect to external URLs
  const safeNext =
    rawNext.startsWith("/app") || rawNext.startsWith("/admin")
      ? rawNext
      : "/app/dashboard";

  const rawToken = request.cookies.get("refresh_token")?.value;

  if (!rawToken) {
    return deleteAndRedirectToLogin(request);
  }

  const hash = hashRefreshToken(rawToken);
  const now = new Date();

  const [session] = await db
    .select({
      id: userSessions.id,
      userId: userSessions.userId,
      tenantId: userSessions.tenantId,
    })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.refreshTokenHash, hash),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!session) {
    return deleteAndRedirectToLogin(request);
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, status: users.status })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || user.status !== "active") {
    return deleteAndRedirectToLogin(request);
  }

  // Prefer the session's stored tenant (set on login or tenant switch).
  // Fall back to first active membership only for legacy sessions where tenantId IS NULL.
  // If the stored tenant membership was explicitly deactivated, treat it as revoked — do not
  // silently switch the user to another tenant they still belong to.
  let membership: { id: string; tenantId: string } | undefined;

  if (session.tenantId) {
    const [stored] = await db
      .select({ id: memberships.id, tenantId: memberships.tenantId })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.tenantId, session.tenantId),
          eq(memberships.status, "active")
        )
      )
      .limit(1);
    if (!stored) {
      // Stored tenant membership is missing or deactivated — force re-login.
      return deleteAndRedirectToLogin(request);
    }
    membership = stored;
  } else {
    // Legacy session with no stored tenantId: fall back to first active membership.
    const [first] = await db
      .select({ id: memberships.id, tenantId: memberships.tenantId })
      .from(memberships)
      .where(
        and(eq(memberships.userId, user.id), eq(memberships.status, "active"))
      )
      .limit(1);
    membership = first;
  }

  if (!membership) {
    return deleteAndRedirectToLogin(request);
  }

  const userRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .innerJoin(membershipRoles, eq(membershipRoles.roleId, roles.id))
    .where(eq(membershipRoles.membershipId, membership.id));

  const roleIds = userRoles.map((r) => r.id);
  const perms = await loadPermissionsForRoles(roleIds);
  const newAccessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    tenant_id: membership.tenantId,
    permissions: perms,
    role_ids: roleIds,
  });

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.redirect(new URL(safeNext, request.url));
  response.cookies.set("access_token", newAccessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });

  return response;
}
