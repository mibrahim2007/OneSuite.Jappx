"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  roles,
  rolePermissions,
  permissions,
  membershipRoles,
} from "@/lib/db/schema";
import { createAuditLog } from "@/lib/audit";
import { getActionUser } from "@/lib/auth/get-action-user";
import { requirePermission } from "@/lib/auth/permissions";
import { withTenantRLS } from "@/lib/db/with-tenant";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/role";
import type { ActionResult } from "@/types";

type RoleActionState = ActionResult<{ id: string }> | null;

export async function createRoleAction(
  _prev: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("admin:role:create", user);
  if (permError) return permError;

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    permissionIds: formData.getAll("permissionIds") as string[],
  };

  const parsed = createRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, description, permissionIds } = parsed.data;

  const result = await withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    async (tx) => {
      // Check for duplicate role name in this tenant
      const [existing] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, user.tenant_id), eq(roles.name, name)))
        .limit(1);

      if (existing) {
        return { success: false as const, error: "A role with this name already exists." };
      }

      const [newRole] = await tx
        .insert(roles)
        .values({ tenantId: user.tenant_id, name, description, isSystem: false })
        .returning({ id: roles.id });

      if (!newRole) throw new Error("Failed to create role.");

      if (permissionIds.length > 0) {
        const validPerms = await tx
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.id, permissionIds));
        const validIds = new Set(validPerms.map((p) => p.id));
        const invalidIds = permissionIds.filter((id) => !validIds.has(id));
        if (invalidIds.length > 0) {
          throw new Error(`Invalid permission IDs submitted.`);
        }
        await tx.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId: newRole.id, permissionId }))
        );
      }

      return { success: true as const, data: { id: newRole.id } };
    }
  );

  if (!result.success) return result;

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "roles",
    entityId: result.data.id,
    action: "role_created",
    changes: { name, description, permissionCount: permissionIds.length },
  });

  revalidatePath("/admin/roles");
  return result;
}

export async function updateRoleAction(
  _prev: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("admin:role:update", user);
  if (permError) return permError;

  const raw = {
    roleId: formData.get("roleId") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    permissionIds: formData.getAll("permissionIds") as string[],
  };

  const parsed = updateRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { roleId, name, description, permissionIds } = parsed.data;

  const result = await withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    async (tx) => {
      // Verify role is custom and belongs to this tenant
      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.tenantId, user.tenant_id),
            eq(roles.isSystem, false)
          )
        )
        .limit(1);

      if (!role) {
        return { success: false as const, error: "Role not found or cannot be edited." };
      }

      // Check for duplicate name (exclude current role)
      const [duplicate] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, user.tenant_id),
            eq(roles.name, name),
            sql`${roles.id} != ${roleId}`
          )
        )
        .limit(1);

      if (duplicate) {
        return { success: false as const, error: "A role with this name already exists." };
      }

      await tx
        .update(roles)
        .set({ name, description, updatedAt: new Date() })
        .where(eq(roles.id, roleId));

      // Compute permission diff
      const currentPerms = await tx
        .select({ permissionId: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      const currentIds = currentPerms.map((p) => p.permissionId);
      const added = permissionIds.filter((id) => !currentIds.includes(id));
      const removed = currentIds.filter((id) => !permissionIds.includes(id));

      if (removed.length > 0) {
        await tx
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, roleId),
              inArray(rolePermissions.permissionId, removed)
            )
          );
      }

      if (added.length > 0) {
        const validPerms = await tx
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.id, added));
        const validIds = new Set(validPerms.map((p) => p.id));
        const invalidIds = added.filter((id) => !validIds.has(id));
        if (invalidIds.length > 0) throw new Error("Invalid permission IDs submitted.");

        await tx.insert(rolePermissions).values(
          added.map((permissionId) => ({ roleId, permissionId }))
        );
      }

      return { success: true as const, data: { id: roleId } };
    }
  );

  if (!result.success) return result;

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "roles",
    entityId: result.data.id,
    action: "role_updated",
    changes: { name, description },
  });

  revalidatePath("/admin/roles");
  return result;
}

export async function deleteRoleAction(
  roleId: string
): Promise<ActionResult<undefined>> {
  const user = await getActionUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const permError = requirePermission("admin:role:delete", user);
  if (permError) return permError;

  const result = await withTenantRLS(
    { tenantId: user.tenant_id, userId: user.sub, permissions: user.permissions },
    async (tx) => {
      // Guard inside the transaction so the count and delete are atomic.
      // Filter by tenantId to prevent leaking assignment counts for foreign roles.
      const [countResult] = await tx
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(membershipRoles)
        .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
        .where(
          and(
            eq(membershipRoles.roleId, roleId),
            eq(roles.tenantId, user.tenant_id)
          )
        );

      const assignedCount = countResult?.count ?? 0;
      if (assignedCount > 0) {
        return {
          success: false as const,
          error: `This role is assigned to ${assignedCount} user${assignedCount === 1 ? "" : "s"} — reassign them before deleting.`,
        };
      }

      // Only delete custom roles that belong to this tenant
      await tx
        .delete(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.tenantId, user.tenant_id),
            eq(roles.isSystem, false)
          )
        );

      return { success: true as const };
    }
  );

  if (!result.success) return result;

  await createAuditLog({
    tenantId: user.tenant_id,
    userId: user.sub,
    entity: "roles",
    entityId: roleId,
    action: "role_deleted",
    changes: null,
  });

  revalidatePath("/admin/roles");
  return { success: true, data: undefined };
}
