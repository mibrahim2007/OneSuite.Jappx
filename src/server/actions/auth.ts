"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { eq, and, gt, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { SignJWT, jwtVerify } from "jose";

import { db } from "@/lib/db";
import {
  users,
  tenants,
  memberships,
  roles,
  membershipRoles,
  userSessions,
  auditLogs,
  passwordResets,
  mfaRecoveryCodes,
} from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import {
  generateRefreshToken,
  hashRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from "@/lib/auth/session";
import { decryptSecret, verifyTotpCode, hashRecoveryCode } from "@/lib/auth/mfa";
import { loadPermissionsForRoles } from "@/lib/auth/permissions";
import { sendPasswordResetEmail } from "@/lib/email";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

type RegisterActionState = {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
} | null;

async function generateUniqueSlug(orgName: string): Promise<string> {
  const base =
    orgName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "org";

  let slug = base;
  let suffix = 2;

  while (true) {
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (!existing) return slug;
    slug = `${base}-${suffix++}`;
  }
}

export async function registerAction(
  _prev: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    orgName: formData.get("orgName"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const { name, email, password, orgName } = parsed.data;

  // Email uniqueness check before transaction
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return {
      success: false,
      error: "An account with this email already exists.",
    };
  }

  // Expensive ops before transaction to keep it short
  const [passwordHash, slug] = await Promise.all([
    hashPassword(password),
    generateUniqueSlug(orgName),
  ]);

  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Read request metadata before transaction
  const h = await headers();
  const userAgent = h.get("user-agent") ?? undefined;
  const forwardedFor = h.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? (forwardedFor.split(",")[0]?.trim() ?? undefined)
    : undefined;

  // Atomic provisioning: user → tenant → membership → role → membership_role → session
  let txResult: { userId: string; tenantId: string; roleId: string };
  try {
    txResult = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: name,
        status: "active", // override schema default 'invited'
      })
      .returning({ id: users.id });

    const [newTenant] = await tx
      .insert(tenants)
      .values({ name: orgName, slug })
      .returning({ id: tenants.id });

    const [newMembership] = await tx
      .insert(memberships)
      .values({
        tenantId: newTenant!.id,
        userId: newUser!.id,
        isOwner: true,
        status: "active",
      })
      .returning({ id: memberships.id });

    const [adminRole] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.name, "Tenant Admin"),
          eq(roles.isSystem, true),
          isNull(roles.tenantId)
        )
      )
      .limit(1);

    if (!adminRole) {
      throw new Error(
        "System roles not seeded. Apply migration 003_seed_rbac_catalog before provisioning tenants."
      );
    }

    await tx.insert(membershipRoles).values({
      membershipId: newMembership!.id,
      roleId: adminRole!.id,
    });

    await tx.insert(userSessions).values({
      userId: newUser!.id,
      tenantId: newTenant!.id,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: sessionExpiresAt,
    });

    return {
      userId: newUser!.id,
      tenantId: newTenant!.id,
      roleId: adminRole!.id,
    };
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("23505") || msg.includes("unique constraint")) {
      return { success: false, error: "An account with this email already exists." };
    }
    throw err;
  }

  const { userId, tenantId, roleId } = txResult;
  const perms = await loadPermissionsForRoles([roleId]);
  const accessToken = await signAccessToken({
    sub: userId,
    email,
    tenant_id: tenantId,
    permissions: perms,
    role_ids: [roleId],
  });

  await setAuthCookies(accessToken, rawRefreshToken);

  redirect("/app/dashboard");
}

// ─── Login ─────────────────────────────────────────────────────────────────

export type LoginActionState =
  | { success: false; error: string }
  | { mfaRequired: true }
  | null;

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
}

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const isProd = process.env.NODE_ENV === "production";

  // ─── Phase 2: MFA code verification ────────────────────────────────────────
  // totp_code present + no email = second factor submission
  if (formData.has("totp_code") && !formData.has("email")) {
    const store = await cookies();
    const pendingToken = store.get("mfa_pending")?.value;
    if (!pendingToken) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    type PendingPayload = {
      sub: string;
      email: string;
      tenant_id: string;
      role_ids: string[];
      ip?: string;
      ua?: string;
    };

    let pendingPayload: PendingPayload;
    try {
      const { payload } = await jwtVerify(pendingToken, getJwtSecret());
      if (payload["purpose"] !== "mfa_pending") throw new Error("Wrong purpose");
      pendingPayload = payload as unknown as PendingPayload;
    } catch {
      store.delete("mfa_pending");
      return { success: false, error: "Session expired. Please sign in again." };
    }

    const totpCode = (formData.get("totp_code") as string).replace(/\s/g, "");

    const [mfaUser] = await db
      .select({ mfaSecret: users.mfaSecret, mfaLastTotpStep: users.mfaLastTotpStep })
      .from(users)
      .where(eq(users.id, pendingPayload.sub))
      .limit(1);

    let verified = false;
    let usedRecoveryCodeId: string | null = null;
    let usedTotpStep: number | null = null;

    if (mfaUser?.mfaSecret) {
      const secret = decryptSecret(mfaUser.mfaSecret);
      if (verifyTotpCode(totpCode, secret)) {
        const currentStep = Math.floor(Date.now() / 30000);
        if (mfaUser.mfaLastTotpStep === currentStep) {
          // Same step already used — reject replay
          return { success: false, error: "Invalid code. Please try again." };
        }
        verified = true;
        usedTotpStep = currentStep;
      }
    }

    // Recovery code fallback
    if (!verified) {
      const codeHash = hashRecoveryCode(totpCode);
      const [recoveryCode] = await db
        .select({ id: mfaRecoveryCodes.id })
        .from(mfaRecoveryCodes)
        .where(
          and(
            eq(mfaRecoveryCodes.userId, pendingPayload.sub),
            eq(mfaRecoveryCodes.codeHash, codeHash),
            isNull(mfaRecoveryCodes.usedAt)
          )
        )
        .limit(1);
      if (recoveryCode) {
        verified = true;
        usedRecoveryCodeId = recoveryCode.id;
      }
    }

    if (!verified) {
      return { success: false, error: "Invalid code. Please try again." };
    }

    const rawRefreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(rawRefreshToken);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Session creation, recovery-code invalidation, and TOTP step update are atomic.
    await db.transaction(async (tx) => {
      await tx.insert(userSessions).values({
        userId: pendingPayload.sub,
        tenantId: pendingPayload.tenant_id,
        refreshTokenHash,
        userAgent: pendingPayload.ua,
        ipAddress: pendingPayload.ip,
        expiresAt: sessionExpiresAt,
      });
      if (usedRecoveryCodeId) {
        await tx
          .update(mfaRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(eq(mfaRecoveryCodes.id, usedRecoveryCodeId));
      }
      if (usedTotpStep !== null) {
        await tx
          .update(users)
          .set({ mfaLastTotpStep: usedTotpStep })
          .where(eq(users.id, pendingPayload.sub));
      }
    });

    void Promise.all([
      db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, pendingPayload.sub)),
      db.insert(auditLogs).values({
        userId: pendingPayload.sub,
        entity: "users",
        entityId: pendingPayload.sub,
        action: "login",
        ipAddress: pendingPayload.ip,
      }),
    ]);

    const perms = await loadPermissionsForRoles(pendingPayload.role_ids);
    const accessToken = await signAccessToken({
      sub: pendingPayload.sub,
      email: pendingPayload.email,
      tenant_id: pendingPayload.tenant_id,
      permissions: perms,
      role_ids: pendingPayload.role_ids,
    });

    store.delete("mfa_pending");
    await setAuthCookies(accessToken, rawRefreshToken);

    redirect("/app/dashboard");
  }

  // ─── Phase 1: Password verification ────────────────────────────────────────
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: "Please enter a valid email and password." };
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }

  // Lockout check: ≥5 failed attempts in last 15 minutes
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const [countResult] = await db
    .select({ failedCount: sql<number>`cast(count(*) as integer)` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, user.id),
        eq(auditLogs.action, "login_failed"),
        gt(auditLogs.createdAt, fifteenMinAgo)
      )
    );

  const failedCount = countResult?.failedCount ?? 0;

  if (failedCount >= 5) {
    return {
      success: false,
      error:
        "Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.",
    };
  }

  // Read request metadata before password check
  const h = await headers();
  const userAgent = h.get("user-agent") ?? undefined;
  const forwardedFor = h.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? (forwardedFor.split(",")[0]?.trim() ?? undefined)
    : undefined;

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    await db.insert(auditLogs).values({
      userId: user.id,
      entity: "users",
      entityId: user.id,
      action: "login_failed",
      ipAddress,
    });
    return { success: false, error: "Invalid email or password." };
  }

  if (user.status !== "active") {
    return {
      success: false,
      error: "Account suspended. Please contact support.",
    };
  }

  // Get first active membership
  const [membership] = await db
    .select({ id: memberships.id, tenantId: memberships.tenantId })
    .from(memberships)
    .where(
      and(eq(memberships.userId, user.id), eq(memberships.status, "active"))
    )
    .limit(1);

  if (!membership) {
    return {
      success: false,
      error: "No active organization found. Contact support.",
    };
  }

  // Get user's roles for JWT claims
  const userRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .innerJoin(membershipRoles, eq(membershipRoles.roleId, roles.id))
    .where(eq(membershipRoles.membershipId, membership.id));

  // ─── MFA fork ──────────────────────────────────────────────────────────────
  if (user.mfaEnabled) {
    const pendingToken = await new SignJWT({
      purpose: "mfa_pending",
      sub: user.id,
      email: user.email,
      tenant_id: membership.tenantId,
      role_ids: userRoles.map((r) => r.id),
      ip: ipAddress,
      ua: userAgent,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(getJwtSecret());

    const store = await cookies();
    store.set("mfa_pending", pendingToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });

    return { mfaRequired: true };
  }

  // ─── No MFA: create session ─────────────────────────────────────────────────
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(userSessions).values({
    userId: user.id,
    tenantId: membership.tenantId,
    refreshTokenHash,
    userAgent,
    ipAddress,
    expiresAt: sessionExpiresAt,
  });

  // Non-critical updates — fire and forget
  void Promise.all([
    db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id)),
    db.insert(auditLogs).values({
      userId: user.id,
      entity: "users",
      entityId: user.id,
      action: "login",
      ipAddress,
    }),
  ]);

  const loginRoleIds = userRoles.map((r) => r.id);
  const loginPerms = await loadPermissionsForRoles(loginRoleIds);
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    tenant_id: membership.tenantId,
    permissions: loginPerms,
    role_ids: loginRoleIds,
  });

  await setAuthCookies(accessToken, rawRefreshToken);

  redirect("/app/dashboard");
}

// ─── Forgot Password ────────────────────────────────────────────────────────

export type ForgotPasswordState = { submitted: true } | null;

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = z.string().email().safeParse(formData.get("email"));

  // Always return submitted:true — no enumeration regardless of email validity
  if (!parsed.success) {
    return { submitted: true };
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, parsed.data))
    .limit(1);

  if (user) {
    // Remove any existing tokens for this user before creating a new one
    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;

    // Fire-and-forget — email failure must not reveal whether the email was found
    sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
  }

  return { submitted: true };
}

// ─── Reset Password ─────────────────────────────────────────────────────────

export type ResetPasswordState = { success: false; error: string } | null;

const resetPasswordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Max 128 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[0-9]/, "At least one digit")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = formData.get("token");
  const password = formData.get("password");

  if (typeof token !== "string" || !token) {
    return { success: false, error: "Invalid reset link." };
  }

  const passwordParsed = resetPasswordSchema.safeParse(password);
  if (!passwordParsed.success) {
    return {
      success: false,
      error:
        passwordParsed.error.issues[0]?.message ??
        "Password does not meet requirements.",
    };
  }

  const tokenHash = hashRefreshToken(token);
  const now = new Date();

  const [reset] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, now)
      )
    )
    .limit(1);

  if (!reset) {
    return {
      success: false,
      error:
        "This reset link has expired or has already been used. Please request a new one.",
    };
  }

  const newPasswordHash = await hashPassword(passwordParsed.data);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, reset.userId));

    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, reset.id));

    await tx
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(userSessions.userId, reset.userId),
          isNull(userSessions.revokedAt)
        )
      );
  });

  void db.insert(auditLogs).values({
    userId: reset.userId,
    entity: "users",
    entityId: reset.userId,
    action: "password_reset",
  });

  await clearAuthCookies();

  redirect("/login");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get("refresh_token")?.value;

  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.refreshTokenHash, tokenHash));
  }

  await clearAuthCookies();
  redirect("/login");
}
