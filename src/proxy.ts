import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  // No token at all
  if (!token) {
    const hasRefresh = request.cookies.has("refresh_token");
    if (hasRefresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/api/auth/refresh";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  let claims: { permissions?: string[] };
  try {
    const { payload } = await jwtVerify(token, getSecret());
    claims = payload as { permissions?: string[] };
  } catch {
    // Token expired or invalid — try refresh
    const hasRefresh = request.cookies.has("refresh_token");
    if (hasRefresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/api/auth/refresh";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /admin/** requires at least one admin:* permission
  if (pathname.startsWith("/admin")) {
    const hasAdminAccess = (claims.permissions ?? []).some((p) =>
      p.startsWith("admin:")
    );
    if (!hasAdminAccess) {
      return NextResponse.redirect(new URL("/app/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
