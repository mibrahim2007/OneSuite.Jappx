"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/server/actions/auth";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "Max 128 characters")
      .regex(/[A-Z]/, "At least one uppercase letter")
      .regex(/[0-9]/, "At least one digit")
      .regex(/[^A-Za-z0-9]/, "At least one special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetFormInput = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [serverState, dispatch, isPending] = useActionState<
    ResetPasswordState,
    globalThis.FormData
  >(resetPasswordAction, null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormInput>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: ResetFormInput) {
    const fd = new globalThis.FormData();
    fd.append("token", token);
    fd.append("password", data.password);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Input
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Input
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
      {serverState?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverState.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
