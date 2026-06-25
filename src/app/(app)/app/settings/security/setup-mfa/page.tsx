import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { toDataURL } from "qrcode";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyAccessToken } from "@/lib/auth/jwt";
import {
  formatSecretForDisplay,
  generateTotpSecret,
  generateTotpUri,
} from "@/lib/auth/mfa";
import { SetupMfaForm } from "@/components/auth/setup-mfa-form";

export const metadata: Metadata = {
  title: "Enable 2FA — OneSuite",
};

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
}

export default async function SetupMfaPage() {
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

  const [dbUser] = await db
    .select({ email: users.email, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser || dbUser.mfaEnabled) {
    redirect("/app/settings/security");
  }

  const secret = generateTotpSecret();
  const uri = generateTotpUri(dbUser.email, secret);
  const qrDataUrl = await toDataURL(uri, { width: 200 });

  const setupToken = await new SignJWT({
    secret,
    purpose: "mfa_setup",
    sub: userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getJwtSecret());

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Enable two-factor authentication
          </h1>
          <p className="text-sm text-muted-foreground">
            Scan the QR code with your authenticator app, then enter the
            6-digit code to confirm.
          </p>
        </div>
        <SetupMfaForm
          qrDataUrl={qrDataUrl}
          manualCode={formatSecretForDisplay(secret)}
          setupToken={setupToken}
        />
      </div>
    </div>
  );
}
