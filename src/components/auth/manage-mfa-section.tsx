"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disableMfaAction, type DisableMfaState } from "@/server/actions/mfa";

type Props = {
  mfaEnabled: boolean;
};

export function ManageMfaSection({ mfaEnabled }: Props) {
  const router = useRouter();
  const [serverState, dispatch, isPending] = useActionState<
    DisableMfaState,
    globalThis.FormData
  >(disableMfaAction, null);

  const [showDisableForm, setShowDisableForm] = useState(false);
  const [code, setCode] = useState("");

  // On successful disable, refresh page to get updated mfaEnabled = false
  if (serverState?.success) {
    router.refresh();
    return null;
  }

  function handleDisableSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new globalThis.FormData();
    fd.append("totp_code", code.replace(/\s/g, ""));
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-xs text-muted-foreground">
            {mfaEnabled
              ? "Your account is protected with an authenticator app."
              : "Add an extra layer of security to your account."}
          </p>
        </div>

        {mfaEnabled ? (
          <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            Enabled
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Disabled
          </span>
        )}
      </div>

      {mfaEnabled ? (
        <>
          {!showDisableForm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisableForm(true)}
            >
              Disable 2FA
            </Button>
          ) : (
            <form onSubmit={handleDisableSubmit} className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter your current authenticator code or a recovery code to
                confirm.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000 000"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={11}
                  className="max-w-[160px] text-center tracking-widest"
                />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={isPending || !code.trim()}
                >
                  {isPending ? "Disabling…" : "Confirm"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDisableForm(false);
                    setCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
              {serverState !== null && !serverState.success && (
                <p className="text-xs text-destructive">{serverState.error}</p>
              )}
            </form>
          )}
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/app/settings/security/setup-mfa")}
        >
          Enable 2FA
        </Button>
      )}
    </div>
  );
}
