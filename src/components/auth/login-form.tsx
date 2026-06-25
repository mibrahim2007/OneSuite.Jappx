"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginActionState } from "@/server/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const [serverState, dispatch, isPending] = useActionState<
    LoginActionState,
    globalThis.FormData
  >(loginAction, null);

  // Track MFA phase separately so error responses don't revert to password form
  const [inMfaPhase, setInMfaPhase] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Transition to MFA phase when server returns mfaRequired
  useEffect(() => {
    if (serverState !== null && "mfaRequired" in serverState) {
      setInMfaPhase(true);
    }
  }, [serverState]);

  function onPasswordSubmit(data: LoginInput) {
    const fd = new globalThis.FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    startTransition(() => dispatch(fd));
  }

  function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new globalThis.FormData();
    fd.append("totp_code", mfaCode.replace(/\s/g, ""));
    startTransition(() => dispatch(fd));
  }

  function handleBack() {
    setInMfaPhase(false);
    setMfaCode("");
    router.push("/login");
  }

  // Derive error: only show "error" state messages that belong to the current phase
  const errorMessage =
    serverState !== null && "error" in serverState
      ? serverState.error
      : null;

  // ─── MFA challenge ──────────────────────────────────────────────────────────
  if (inMfaPhase) {
    return (
      <form onSubmit={onMfaSubmit} className="space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code from your authenticator app, or a recovery
            code.
          </p>
        </div>

        <Input
          type="text"
          inputMode="numeric"
          placeholder="000 000"
          autoComplete="one-time-code"
          autoFocus
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          maxLength={11}
          className="text-center tracking-widest text-lg"
        />

        {errorMessage && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isPending || !mfaCode.trim()}
        >
          {isPending ? "Verifying…" : "Verify"}
        </Button>

        <button
          type="button"
          onClick={handleBack}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to sign in
        </button>
      </form>
    );
  }

  // ─── Password phase ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Input
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {errorMessage && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-foreground"
        >
          Forgot password?
        </Link>
        <Link
          href="/register"
          className="text-muted-foreground hover:text-foreground"
        >
          Create account
        </Link>
      </div>
    </form>
  );
}
