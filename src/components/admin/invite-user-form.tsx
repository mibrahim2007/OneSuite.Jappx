"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { inviteUserAction } from "@/server/actions/invitations";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validations/invitation";

type Role = { id: string; name: string; isSystem: boolean };

type InviteState =
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | { success: true; data: { id: string } }
  | null;

export function InviteUserForm({ roles }: { roles: Role[] }) {
  const [state, dispatch, isPending] = useActionState<InviteState, FormData>(
    inviteUserAction,
    null
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
  });

  const serverError = state?.success === false ? state : null;
  const fieldErrors = serverError?.fieldErrors;

  function onSubmit(data: InviteUserInput) {
    const fd = new FormData();
    fd.append("email", data.email);
    fd.append("roleId", data.roleId);
    startTransition(() => {
      dispatch(fd);
    });
    if (state?.success) reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && !fieldErrors && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError.error}
        </div>
      )}

      {state?.success === true && (
        <div className="rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
          Invitation sent successfully.
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="colleague@company.com"
          autoComplete="off"
          aria-invalid={!!errors.email || !!fieldErrors?.email}
          {...register("email")}
        />
        {(errors.email || fieldErrors?.email) && (
          <p className="text-sm text-destructive">
            {errors.email?.message ?? fieldErrors?.email?.[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-invalid={!!errors.roleId || !!fieldErrors?.roleId}
          {...register("roleId")}
        >
          <option value="">Select a role…</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        {(errors.roleId || fieldErrors?.roleId) && (
          <p className="text-sm text-destructive">
            {errors.roleId?.message ?? fieldErrors?.roleId?.[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
