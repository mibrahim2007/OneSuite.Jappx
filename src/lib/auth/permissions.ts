import { inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { permissions, rolePermissions } from "@/lib/db/schema";
import type { JWTPayload } from "@/types";

export function hasPermission(permission: string, claims: JWTPayload): boolean {
  return claims.permissions.includes(permission);
}

export function hasAnyPermission(perms: string[], claims: JWTPayload): boolean {
  return perms.some((p) => claims.permissions.includes(p));
}

// Returns an ActionResult-shaped error if denied, or null if allowed.
// Usage: const err = requirePermission("admin:role:create", user); if (err) return err;
export function requirePermission(
  permission: string,
  claims: JWTPayload
): { success: false; error: string } | null {
  if (!claims.permissions.includes(permission)) {
    return { success: false, error: "You don't have permission to perform this action." };
  }
  return null;
}

// Loads the permission codes granted to the given role IDs.
// Call this at every token-issuance point so JWTs carry real permissions.
export async function loadPermissionsForRoles(roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return [];
  const rows = await db
    .select({ code: permissions.code })
    .from(permissions)
    .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds));
  return [...new Set(rows.map((r) => r.code))];
}
