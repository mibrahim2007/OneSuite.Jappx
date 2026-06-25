"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull } from "drizzle-orm";
import { toDataURL } from "qrcode";

import { db } from "@/lib/db";
import { auditLogs, mfaRecoveryCodes, users } from "@/lib/db/schema";
import { verifyAccessToken } from "@/lib/auth/jwt";
import {
  decryptSecret,
  encryptSecret,
  formatSecretForDisplay,
  generateRecoveryCodes,
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
} from "@/lib/auth/mfa";
import type { JWTPayload } from "@/types";

// ─── Auth Helper ──────────────────────────────────────────────────────────────

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

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
}

// ─── Setup Init ───────────────────────────────────────────────────────────────

export type MfaSetupData = {
  qrDataUrl: string;
  manualCode: string;
  setupToken: string;
};

export type InitMfaSetupState =
  | { success: true; data: MfaSetupData }
  | { success: false; error: string };

export async function initMfaSetupAction(): Promise<InitMfaSetupState> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const [dbUser] = await db
    .select({ email: users.email, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1);

  if (!dbUser) return { success: false, error: "User not found." };
  if (dbUser.mfaEnabled)
    return { success: false, error: "2FA is already enabled." };

  const secret = generateTotpSecret();
  const uri = generateTotpUri(dbUser.email, secret);
  const qrDataUrl = await toDataURL(uri);

  const setupToken = await new SignJWT({
    secret,
    purpose: "mfa_setup",
    sub: user.sub,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getJwtSecret());

  return {
    success: true,
    data: {
      qrDataUrl,
      manualCode: formatSecretForDisplay(secret),
      setupToken,
    },
  };
}

// ─── Enable MFA ───────────────────────────────────────────────────────────────

export type EnableMfaState =
  | { success: true; recoveryCodes: string[] }
  | { success: false; error: string }
  | null;

export async function enableMfaAction(
  _prev: EnableMfaState,
  formData: FormData
): Promise<EnableMfaState> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const setupToken = formData.get("setup_token");
  const totpCode = formData.get("totp_code");

  if (typeof setupToken !== "string" || typeof totpCode !== "string") {
    return { success: false, error: "Invalid request." };
  }

  let secret: string;
  try {
    const { payload } = await jwtVerify(setupToken, getJwtSecret());
    if (payload["purpose"] !== "mfa_setup") throw new Error("Wrong purpose");
    if (payload["sub"] !== user.sub) throw new Error("Token user mismatch");
    secret = payload["secret"] as string;
    if (!secret) throw new Error("No secret in token");
  } catch {
    return {
      success: false,
      error: "Setup session expired. Please refresh and try again.",
    };
  }

  if (!verifyTotpCode(totpCode.replace(/\s/g, ""), secret)) {
    return {
      success: false,
      error: "Invalid code. Check your authenticator app and try again.",
    };
  }

  const encryptedSecret = encryptSecret(secret);
  const { raw, hashed } = generateRecoveryCodes();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ mfaEnabled: true, mfaSecret: encryptedSecret, updatedAt: new Date() })
      .where(eq(users.id, user.sub));

    await tx
      .delete(mfaRecoveryCodes)
      .where(eq(mfaRecoveryCodes.userId, user.sub));

    await tx.insert(mfaRecoveryCodes).values(
      hashed.map((codeHash) => ({ userId: user.sub, codeHash }))
    );

    await tx.insert(auditLogs).values({
      userId: user.sub,
      entity: "users",
      entityId: user.sub,
      action: "mfa_enabled",
    });
  });

  revalidatePath("/app/settings/security");
  return { success: true, recoveryCodes: raw };
}

// ─── Disable MFA ──────────────────────────────────────────────────────────────

export type DisableMfaState =
  | { success: true }
  | { success: false; error: string }
  | null;

export async function disableMfaAction(
  _prev: DisableMfaState,
  formData: FormData
): Promise<DisableMfaState> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const totpCode = formData.get("totp_code");
  if (typeof totpCode !== "string" || !totpCode.trim()) {
    return { success: false, error: "Please enter your authenticator code." };
  }

  const [dbUser] = await db
    .select({ mfaEnabled: users.mfaEnabled, mfaSecret: users.mfaSecret })
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1);

  if (!dbUser?.mfaEnabled || !dbUser.mfaSecret) {
    return { success: false, error: "2FA is not currently enabled." };
  }

  const secret = decryptSecret(dbUser.mfaSecret);

  // Allow recovery code as confirmation too
  let verified = verifyTotpCode(totpCode.replace(/\s/g, ""), secret);

  if (!verified) {
    const { hashRecoveryCode } = await import("@/lib/auth/mfa");
    const codeHash = hashRecoveryCode(totpCode.replace(/\s/g, ""));
    const [recoveryCode] = await db
      .select({ id: mfaRecoveryCodes.id })
      .from(mfaRecoveryCodes)
      .where(
        and(
          eq(mfaRecoveryCodes.userId, user.sub),
          eq(mfaRecoveryCodes.codeHash, codeHash),
          isNull(mfaRecoveryCodes.usedAt)
        )
      )
      .limit(1);
    if (recoveryCode) verified = true;
  }

  if (!verified) {
    return { success: false, error: "Invalid code. Please try again." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ mfaEnabled: false, mfaSecret: null, updatedAt: new Date() })
      .where(eq(users.id, user.sub));

    await tx
      .delete(mfaRecoveryCodes)
      .where(eq(mfaRecoveryCodes.userId, user.sub));

    await tx.insert(auditLogs).values({
      userId: user.sub,
      entity: "users",
      entityId: user.sub,
      action: "mfa_disabled",
    });
  });

  revalidatePath("/app/settings/security");
  return { success: true };
}
