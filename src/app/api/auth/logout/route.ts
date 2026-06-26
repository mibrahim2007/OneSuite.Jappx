import { NextRequest, NextResponse } from "next/server";
import { eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { hashRefreshToken } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get("refresh_token")?.value;

  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.refreshTokenHash, tokenHash));
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}
