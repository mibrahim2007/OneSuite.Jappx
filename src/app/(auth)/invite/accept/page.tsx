import type { Metadata } from "next";
import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitations, roles, tenants, users } from "@/lib/db/schema";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export const metadata: Metadata = {
  title: "Accept invitation — OneSuite",
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  if (!token) {
    return <InvitationError message="Invalid invitation link." />;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [inv] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      tenantName: tenants.name,
      roleName: roles.name,
    })
    .from(invitations)
    .leftJoin(tenants, eq(tenants.id, invitations.tenantId))
    .leftJoin(roles, eq(roles.id, invitations.roleId))
    .where(
      and(
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!inv) {
    return (
      <InvitationError message="This invitation has expired or has already been used." />
    );
  }

  // Check whether the invited email is already a registered user
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, inv.email))
    .limit(1);

  const isExistingUser = !!existingUser;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Accept your invitation
          </h1>
          <p className="text-sm text-muted-foreground">
            {isExistingUser
              ? "Sign in with your existing password to join."
              : "Set up your account to get started."}
          </p>
        </div>
        <AcceptInvitationForm
          token={token}
          email={inv.email}
          orgName={inv.tenantName ?? "your organization"}
          roleName={inv.roleName ?? "Member"}
          isExistingUser={isExistingUser}
        />
      </div>
    </div>
  );
}

function InvitationError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Invitation unavailable
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/login"
          className="inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Go to sign in
        </a>
      </div>
    </div>
  );
}
