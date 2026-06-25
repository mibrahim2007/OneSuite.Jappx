import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { passwordResets } from "@/lib/db/schema";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set new password — OneSuite",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token =
    typeof params.token === "string" ? params.token : undefined;

  if (!token) {
    redirect("/forgot-password");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [reset] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!reset) {
    redirect("/forgot-password?error=expired");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set new password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter a new password for your account
          </p>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
