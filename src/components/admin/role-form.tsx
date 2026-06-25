"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionPicker, type PermissionItem } from "@/components/admin/permission-picker";
import { createRoleAction, updateRoleAction } from "@/server/actions/roles";
import { createRoleSchema, type CreateRoleInput } from "@/lib/validations/role";

type RoleActionState =
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | { success: true; data: { id: string } }
  | null;

type ExistingRole = {
  id: string;
  name: string;
  description: string | null;
  currentPermissionIds: string[];
};

type RoleFormProps = {
  permissions: PermissionItem[];
  existingRole?: ExistingRole;
};

export function RoleForm({ permissions, existingRole }: RoleFormProps) {
  const router = useRouter();
  const isEdit = !!existingRole;

  const [state, dispatch, isPending] = useActionState<RoleActionState, FormData>(
    isEdit ? updateRoleAction : createRoleAction,
    null
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: existingRole?.name ?? "",
      description: existingRole?.description ?? "",
      permissionIds: existingRole?.currentPermissionIds ?? [],
    },
  });

  const serverError = state?.success === false ? state : null;
  const fieldErrors = serverError?.fieldErrors;

  useEffect(() => {
    if (state?.success === true) {
      router.push("/admin/roles");
    }
  }, [state, router]);

  function onSubmit(data: CreateRoleInput) {
    const fd = new FormData();
    fd.append("name", data.name);
    if (data.description) fd.append("description", data.description);
    if (isEdit && existingRole) fd.append("roleId", existingRole.id);
    (data.permissionIds ?? []).forEach((id) => fd.append("permissionIds", id));
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError && !fieldErrors && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="role-name">Role name</Label>
        <Input
          id="role-name"
          type="text"
          placeholder="e.g. Finance Viewer"
          autoComplete="off"
          aria-invalid={!!errors.name || !!fieldErrors?.name}
          {...register("name")}
        />
        {(errors.name || fieldErrors?.name) && (
          <p className="text-sm text-destructive">
            {errors.name?.message ?? fieldErrors?.name?.[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role-description">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="role-description"
          placeholder="Describe what this role can do…"
          rows={2}
          aria-invalid={!!errors.description || !!fieldErrors?.description}
          {...register("description")}
        />
        {(errors.description || fieldErrors?.description) && (
          <p className="text-sm text-destructive">
            {errors.description?.message ?? fieldErrors?.description?.[0]}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Permissions</Label>
        {fieldErrors?.permissionIds && (
          <p className="text-sm text-destructive">{fieldErrors.permissionIds[0]}</p>
        )}
        <Controller
          control={control}
          name="permissionIds"
          render={({ field }) => (
            <PermissionPicker
              permissions={permissions}
              selectedIds={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create role"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/roles")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
