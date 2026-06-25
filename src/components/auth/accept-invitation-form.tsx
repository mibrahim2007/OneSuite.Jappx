"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { acceptInvitationAction } from "@/server/actions/invitations";
import { acceptInvitationSchema } from "@/lib/validations/invitation";

const newUserPasswordPolicy = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Max 128 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[0-9]/, "At least one digit")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

const newUserSchema = acceptInvitationSchema.extend({
  password: newUserPasswordPolicy,
});

type AcceptState =
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | null;

type FormValues = z.infer<typeof acceptInvitationSchema>;

type AcceptInvitationFormProps = {
  token: string;
  email: string;
  orgName: string;
  roleName: string;
  isExistingUser: boolean;
};

export function AcceptInvitationForm({
  token,
  email,
  orgName,
  roleName,
  isExistingUser,
}: AcceptInvitationFormProps) {
  const [state, dispatch, isPending] = useActionState<AcceptState, FormData>(
    acceptInvitationAction,
    null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isExistingUser ? acceptInvitationSchema : newUserSchema),
  });

  const serverError = state?.success === false ? state : null;
  const fieldErrors = serverError?.fieldErrors;

  function onSubmit(data: FormValues) {
    const fd = new FormData();
    fd.append("token", token);
    fd.append("fullName", data.fullName);
    fd.append("password", data.password);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && !fieldErrors && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError.error}
        </div>
      )}

      {/* Read-only email display */}
      <div className="space-y-1.5">
        <Label>Email address</Label>
        <p className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
          {email}
        </p>
        <p className="text-xs text-muted-foreground">
          Joining <strong>{orgName}</strong> as <strong>{roleName}</strong>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          placeholder="Jane Smith"
          autoComplete="name"
          aria-invalid={!!errors.fullName || !!fieldErrors?.fullName}
          {...register("fullName")}
        />
        {(errors.fullName || fieldErrors?.fullName) && (
          <p className="text-sm text-destructive">
            {errors.fullName?.message ?? fieldErrors?.fullName?.[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          {isExistingUser ? "Your OneSuite password" : "Choose a password"}
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={
            isExistingUser
              ? "Enter your existing password"
              : "Min. 8 chars, 1 uppercase, 1 digit, 1 special"
          }
          autoComplete={isExistingUser ? "current-password" : "new-password"}
          aria-invalid={!!errors.password || !!fieldErrors?.password}
          {...register("password")}
        />
        {(errors.password || fieldErrors?.password) && (
          <p className="text-sm text-destructive">
            {errors.password?.message ?? fieldErrors?.password?.[0]}
          </p>
        )}
        {!isExistingUser && !errors.password && (
          <p className="text-xs text-muted-foreground">
            At least 8 characters with 1 uppercase letter, 1 digit, and 1 special character.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending} size="lg">
        {isPending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  );
}
