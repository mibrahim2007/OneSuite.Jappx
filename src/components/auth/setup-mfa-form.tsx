"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enableMfaAction, type EnableMfaState } from "@/server/actions/mfa";

type Props = {
  qrDataUrl: string;
  manualCode: string;
  setupToken: string;
};

// Avoids collision with native FormData type
type EnableMfaFormInput = z.infer<typeof schema>;
const schema = z.object({ totp_code: z.string().min(6).max(11) });

export function SetupMfaForm({ qrDataUrl, manualCode, setupToken }: Props) {
  const router = useRouter();
  const [serverState, dispatch, isPending] = useActionState<
    EnableMfaState,
    globalThis.FormData
  >(enableMfaAction, null);

  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new globalThis.FormData();
    fd.append("totp_code", code.replace(/\s/g, ""));
    fd.append("setup_token", setupToken);
    startTransition(() => dispatch(fd));
  }

  async function copyCode(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Recovery codes display (one-time) ─────────────────────────────────────
  if (serverState?.success) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            2FA enabled successfully!
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Save your recovery codes</p>
          <p className="text-xs text-muted-foreground">
            Store these codes in a safe place. Each can be used once to sign in
            if you lose access to your authenticator app.{" "}
            <span className="font-semibold text-destructive">
              These codes will not be shown again.
            </span>
          </p>

          <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted/50 p-4">
            {serverState.recoveryCodes.map((code) => (
              <li
                key={code}
                className="font-mono text-sm tracking-wider text-foreground"
              >
                {code}
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyCode(serverState.recoveryCodes.join("\n"))}
            className="w-full"
          >
            {copied ? "Copied!" : "Copy all codes"}
          </Button>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => router.push("/app/settings/security")}
        >
          I&apos;ve saved my recovery codes
        </Button>
      </div>
    );
  }

  // ─── Setup form ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="TOTP QR code"
          width={200}
          height={200}
          className="rounded-md border"
        />
      </div>

      <div className="space-y-1 rounded-md border bg-muted/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Can&apos;t scan? Enter this code manually:
        </p>
        <p className="break-all font-mono text-sm tracking-wider">
          {manualCode}
        </p>
      </div>

      <div className="space-y-1">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="000 000"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={7}
          className="text-center tracking-widest text-lg"
        />
        <p className="text-xs text-muted-foreground">
          Enter the 6-digit code shown in your authenticator app.
        </p>
      </div>

      {serverState !== null && !serverState.success && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverState.error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || code.replace(/\s/g, "").length < 6}
      >
        {isPending ? "Verifying…" : "Verify and enable 2FA"}
      </Button>
    </form>
  );
}
