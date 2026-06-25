import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSessions, users } from "@/lib/db/schema";
import { hashRefreshToken } from "@/lib/auth/session";
import { verifyAccessToken } from "@/lib/auth/jwt";
import {
  SessionList,
  type SessionDisplay,
} from "@/components/auth/session-list";
import { ManageMfaSection } from "@/components/auth/manage-mfa-section";

export const metadata: Metadata = {
  title: "Security — OneSuite",
};

export default async function SecurityPage() {
  const store = await cookies();
  const accessToken = store.get("access_token")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  let userId: string;
  try {
    const payload = await verifyAccessToken(accessToken);
    userId = payload.sub;
  } catch {
    redirect("/login");
  }

  const [userRecord] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const mfaEnabled = userRecord?.mfaEnabled ?? false;

  const refreshToken = store.get("refresh_token")?.value;
  const currentHash = refreshToken ? hashRefreshToken(refreshToken) : null;

  const rawSessions = await db
    .select({
      id: userSessions.id,
      userAgent: userSessions.userAgent,
      ipAddress: userSessions.ipAddress,
      createdAt: userSessions.createdAt,
      expiresAt: userSessions.expiresAt,
      refreshTokenHash: userSessions.refreshTokenHash,
    })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(userSessions.createdAt));

  // Build display list — refreshTokenHash must NOT be passed to the client
  const sessions: SessionDisplay[] = rawSessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: currentHash !== null && s.refreshTokenHash === currentHash,
  }));

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="text-sm text-muted-foreground">
            Manage two-factor authentication and active sessions.
          </p>
        </div>
        <ManageMfaSection mfaEnabled={mfaEnabled} />
        <div className="border-t border-border pt-6 space-y-4">
          <div className="space-y-1">
            <p className="text-base font-medium">Active sessions</p>
            <p className="text-sm text-muted-foreground">
              These devices are currently signed in to your account.
            </p>
          </div>
          <SessionList sessions={sessions} />
        </div>
      </div>
    </div>
  );
}
