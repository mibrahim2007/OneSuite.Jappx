"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  invitations,
  memberships,
  membershipRoles,
  roles,
  tenants,
  userSessions,
  users,
} from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import {
  generateRefreshToken,
  hashRefreshToken,
  setAuthCookies,
} from "@/lib/auth/session";
import { getActionUser } from "@/lib/auth/get-action-user";
import { loadPermissionsForRoles, requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { sendInvitationEmail } from "@/lib/email";
import { createAuditLog } from "@/lib/audit";
import { inviteUserSchema, acceptInvitationSchema } from "@/lib/validations/invitation";
import type { ActionResult } from "@/types";

type InviteState =
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | { success: true; data: { id: string } }
  | null;

export async function inviteUserAction(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("admin:user:invite", user);
  if (permError) return permError;

  const raw = {
    email: formData.get("email") as string,
    roleId: formData.get("roleId") as string,
  };

  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, roleId } = parsed.data;

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const result = await withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    async (tx) => {
      // Check for existing membership
      const [existingMember] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.tenantId, user.tenant_id),
            eq(users.email, email)
          )
        )
        .limit(1);

      if (existingMember) {
        return {
          success: false as const,
          error: "This user is already a member of your organization",
        };
      }

      // Delete any existing pending invitation for this email+tenant (re-invite refreshes)
      await tx
        .delete(invitations)
        .where(
          and(
            eq(invitations.tenantId, user.tenant_id),
            eq(invitations.email, email),
            isNull(invitations.acceptedAt)
          )
        );

      // Look up role name — must belong to this tenant (prevents cross-tenant role assignment)
      const [role] = await tx
        .select({ name: roles.name })
        .from(roles)
        .where(and(eq(roles.id, roleId), eq(roles.tenantId, user.tenant_id)))
        .limit(1);

      if (!role) {
        return { success: false as const, error: "Invalid role selected." };
      }

      const [tenant] = await tx
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, user.tenant_id))
        .limit(1);

      // Create invitation
      const [invitation] = await tx
        .insert(invitations)
        .values({
          tenantId: user.tenant_id,
          email,
          roleId,
          tokenHash,
          invitedBy: user.sub,
          expiresAt,
        })
        .returning({ id: invitations.id });

      if (!invitation) throw new Error("Failed to create invitation.");

      return {
        success: true as const,
        data: {
          id: invitation.id,
          roleName: role.name,
          orgName: tenant?.name ?? "your organization",
        },
      };
    }
  );

  if (!result.success) return result;

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "invitations",
    entityId: result.data.id,
    action: "invitation_sent",
    changes: { email, roleId },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${rawToken}`;

  await sendInvitationEmail(
    email,
    inviteUrl,
    user.email,
    result.data.roleName,
    result.data.orgName
  );

  revalidatePath("/admin/users");
  return { success: true, data: { id: result.data.id } };
}

export async function revokeInvitationAction(
  invitationId: string
): Promise<ActionResult<undefined>> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("admin:user:invite", user);
  if (permError) return permError;

  const result = await withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    async (tx) => {
      const deleted = await tx
        .delete(invitations)
        .where(
          and(
            eq(invitations.id, invitationId),
            eq(invitations.tenantId, user.tenant_id),
            isNull(invitations.acceptedAt)
          )
        )
        .returning({ id: invitations.id });

      return deleted.length > 0;
    }
  );

  if (!result) return { success: false, error: "Invitation not found." };

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "invitations",
    entityId: invitationId,
    action: "invitation_revoked",
    changes: null,
  });

  revalidatePath("/admin/users");
  return { success: true, data: undefined };
}

// ─── Public action — no JWT required ─────────────────────────────────────────

type AcceptState =
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | null;

const newUserPasswordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Max 128 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[0-9]/, "At least one digit")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

export async function acceptInvitationAction(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const raw = {
    token: formData.get("token") as string,
    fullName: formData.get("fullName") as string,
    password: formData.get("password") as string,
  };

  const parsed = acceptInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { token, fullName, password } = parsed.data;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the valid invitation (pre-check — race guard re-validates inside tx)
  const [inv] = await db
    .select({
      id: invitations.id,
      tenantId: invitations.tenantId,
      email: invitations.email,
      roleId: invitations.roleId,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!inv) {
    return {
      success: false,
      error: "This invitation has expired or has already been used.",
    };
  }

  // Check if email already registered
  const [existingUser] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, inv.email))
    .limit(1);

  const isNewUser = !existingUser;

  // For new users: apply password policy server-side
  if (isNewUser) {
    const policyCheck = newUserPasswordSchema.safeParse(password);
    if (!policyCheck.success) {
      return {
        success: false,
        error: policyCheck.error.issues[0]?.message ?? "Password does not meet requirements.",
        fieldErrors: { password: [policyCheck.error.issues[0]?.message ?? "Invalid password"] },
      };
    }
  }

  // For existing users: verify password before entering transaction
  if (!isNewUser) {
    const valid = await verifyPassword(existingUser.passwordHash, password);
    if (!valid) {
      return { success: false, error: "Incorrect password." };
    }
  }

  // Hash password for new users BEFORE transaction (argon2 is expensive)
  const passwordHash = isNewUser ? await hashPassword(password) : null;

  // Generate session credentials outside transaction
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  type TxResult =
    | { ok: true; userId: string; tenantId: string; roleId: string | null }
    | { ok: false; error: string };

  // Atomic transaction
  const txResult = await db.transaction(async (tx): Promise<TxResult> => {
    // Race guard: re-validate invitation inside transaction
    const [freshInv] = await tx
      .select({
        id: invitations.id,
        tenantId: invitations.tenantId,
        email: invitations.email,
        roleId: invitations.roleId,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!freshInv) {
      return { ok: false, error: "This invitation has expired or has already been used." };
    }

    let userId: string;

    if (isNewUser) {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: freshInv.email,
          passwordHash: passwordHash!,
          fullName,
          status: "active",
        })
        .returning({ id: users.id });
      userId = newUser!.id;
    } else {
      // Check for duplicate membership
      const [existingMembership] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.tenantId, freshInv.tenantId),
            eq(memberships.userId, existingUser!.id)
          )
        )
        .limit(1);

      if (existingMembership) {
        return { ok: false, error: "You are already a member of this organization." };
      }
      userId = existingUser!.id;
    }

    const [newMembership] = await tx
      .insert(memberships)
      .values({
        tenantId: freshInv.tenantId,
        userId,
        isOwner: false,
        status: "active",
      })
      .returning({ id: memberships.id });

    if (freshInv.roleId) {
      await tx.insert(membershipRoles).values({
        membershipId: newMembership!.id,
        roleId: freshInv.roleId,
      });
    }

    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, freshInv.id));

    return {
      ok: true,
      userId,
      tenantId: freshInv.tenantId,
      roleId: freshInv.roleId,
    };
  });

  if (!txResult.ok) {
    return { success: false, error: txResult.error };
  }

  // Issue session + JWT (outside transaction — redirect() throws internally)
  await db.insert(userSessions).values({
    userId: txResult.userId,
    tenantId: txResult.tenantId,
    refreshTokenHash,
    expiresAt: sessionExpiresAt,
  });

  const roleIds = txResult.roleId ? [txResult.roleId] : [];
  const perms = await loadPermissionsForRoles(roleIds);
  const accessToken = await signAccessToken({
    sub: txResult.userId,
    email: inv.email,
    tenant_id: txResult.tenantId,
    permissions: perms,
    role_ids: roleIds,
  });

  await setAuthCookies(accessToken, rawRefreshToken);
  redirect("/app/dashboard");
}
