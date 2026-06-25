import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "@/types";

type AccessTokenClaims = Omit<JWTPayload, "iat" | "exp">;

function getAccessSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
}

export async function signAccessToken(
  claims: AccessTokenClaims
): Promise<string> {
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAccessSecret());
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret());
  return payload as unknown as JWTPayload;
}
