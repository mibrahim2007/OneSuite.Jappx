"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { hashRefreshToken } from "@/lib/auth/session";
import { verifyAccessToken } from "@/lib/auth/jwt";
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

export async function revokeSessionAction(
  sessionId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const [session] = await db
    .select({
      id: userSessions.id,
      userId: userSessions.userId,
      refreshTokenHash: userSessions.refreshTokenHash,
    })
    .from(userSessions)
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
    .limit(1);

  // Ownership check — prevent revoking another user's session (IDOR guard)
  if (!session || session.userId !== user.sub) {
    return { success: false, error: "Session not found." };
  }

  // Block revoking the current session — user should sign out instead
  const store = await cookies();
  const refreshToken = store.get("refresh_token")?.value;
  const currentHash = refreshToken ? hashRefreshToken(refreshToken) : null;
  if (currentHash && session.refreshTokenHash === currentHash) {
    return {
      success: false,
      error: "Cannot revoke your current session. Use Sign Out instead.",
    };
  }

  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.id, session.id));

  revalidatePath("/app/settings/security");
  return { success: true };
}

export async function revokeAllOtherSessionsAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const store = await cookies();
  const refreshToken = store.get("refresh_token")?.value;
  if (!refreshToken) {
    return { success: false, error: "Cannot identify current session." };
  }

  const currentHash = hashRefreshToken(refreshToken);

  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, user.sub),
        isNull(userSessions.revokedAt),
        ne(userSessions.refreshTokenHash, currentHash)
      )
    );

  revalidatePath("/app/settings/security");
  return { success: true };
}
