"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/server/actions/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotFormInput = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [state, dispatch, isPending] = useActionState<
    ForgotPasswordState,
    globalThis.FormData
  >(forgotPasswordAction, null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormInput>({
    resolver: zodResolver(schema),
  });

  if (state?.submitted) {
    return (
      <p className="rounded-md bg-muted px-4 py-3 text-sm text-center text-muted-foreground">
        If that email is registered, you&apos;ll receive a reset link shortly.
        Check your inbox.
      </p>
    );
  }

  function onSubmit(data: ForgotFormInput) {
    const fd = new globalThis.FormData();
    fd.append("email", data.email);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm">
        <a href="/login" className="text-muted-foreground hover:text-foreground">
          Back to sign in
        </a>
      </p>
    </form>
  );
}
